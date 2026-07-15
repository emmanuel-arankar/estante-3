// =============================================================================
// CONFIGURAÇÕES E IMPORTS DE TESTE (AMIZADES)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { invalidatePattern } from '../lib/cache';

// =============================================================================
// MOCKS ELEVADOS (HOISTED)
// =============================================================================

/**
 * @name Mock Factory Friends
 * @summary Provedor de infraestrutura de teste.
 * @description Mocks elevados para simular o comportamento do Firestore e gerenciar estado global de amizades.
 * Centraliza o estado simulado do banco de dados (docStore) e os resultados de query.
 * 
 * @returns {Object} Contém {state, mockDb, mockBatch, mockTransaction, makeCollectionRef, makeDocSnapshot}
 */
const { state, mockDb, mockBatch, mockTransaction, makeCollectionRef, makeDocSnapshot } = vi.hoisted(() => {
  /**
   * @name Estado Global de Teste
   * @summary Repositório de dados em memória.
   * @description Centraliza os documentos e resultados de consulta para os mocks do Firestore.
   * 
   * @property {Record<string, any>} docStore - Simula o banco de dados chave-valor (caminho/doc).
   * @property {Record<string, any[]>} queryResults - Armazena resultados pré-definidos para simular comportamentos específicos.
   * @property {Record<string, number>} queryCallCount - Contador para permitir que queries sequenciais retornem dados diferentes.
   */
  const state = {
    docStore: {} as Record<string, any>,
    queryResults: {} as Record<string, any[]>,
    queryCallCount: {} as Record<string, number>,
  };

  /**
   * @name Helper Snapshot
   * @summary Cria snapshot de documento.
   * @description Cria um objeto que simula um DocumentSnapshot do Firestore.
   * 
   * @params {string} id - ID do documento
   * @params {any} data - Conteúdo do documento
   * @returns {Object} Snapshot simulado
   * @example
   * const snap = makeDocSnapshot("id1", { name: "test" });
   */
  const makeDocSnapshot = (id: string, data: any) => ({
    exists: data !== undefined,
    data: () => data,
    id,
  });

  /**
   * @name Helper Query Snapshot
   * @summary Simula lista de resultados do Firestore.
   * @description Cria um objeto que simula um QuerySnapshot do Firestore para listas de amizades.
   * 
   * @params {Array<Record<string, any>>} docs - Lista de dados brutos
   * @returns {Object} QuerySnapshot simulado
   * @example
   * const snap = makeQuerySnapshot([{ id: "id1", name: "test" }]);
   */
  const makeQuerySnapshot = (docs: Array<Record<string, any>>) => ({
    docs: docs.map(d => ({ id: d.id, data: () => d, exists: true, ref: { __path: `friendships/${d.id}`, __id: d.id } })),
    empty: docs.length === 0,
  });

  /**
   * @name Helper Doc Reference
   * @summary Simula referência de documento.
   * @description Simula uma referência de documento (DocumentReference) do Firestore com método get.
   * 
   * @params {string} collection - Nome da coleção
   * @params {string} id - ID do documento
   * @returns {Object} DocumentReference simulado
   * @example
   * const ref = makeDocRef("users", "id1");
   */
  const makeDocRef = (collection: string, id: string) => ({
    __path: `${collection}/${id}`,
    __id: id,
    get: vi.fn(() => {
      const data = state.docStore[`${collection}/${id}`];
      return Promise.resolve(makeDocSnapshot(id, data));
    }),
  });

  /**
   * @name Motor de Consulta (Query Engine)
   * @summary Simula o comportamento do Firestore em memória.
   * @description Implementa lógica básica de filtragem (where), ordenação (orderBy) e paginação (limit/offset) 
   * para permitir que os testes validem a lógica de negócio sem dependência de um banco real.
   * Utilizado extensivamente em {@link listFriendsQuerySchema} e {@link listRequestsQuerySchema}.
   */
  const makeQueryChain = (collectionName: string) => {
    let limitVal = 1000;
    let offsetVal = 0;
    const wheres: Array<{ field: string; op: string; val: any }> = [];
    const orders: Array<{ field: string; dir: string }> = [];
    let startAtVal: any = null;

    const chain: any = {};
    chain.where = vi.fn((field, op, val) => { wheres.push({ field, op, val }); return chain; });
    chain.limit = vi.fn((l) => { limitVal = l; return chain; });
    chain.offset = vi.fn((o) => { offsetVal = o; return chain; });
    chain.select = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn((field, dir = 'asc') => { orders.push({ field, dir }); return chain; });
    chain.startAt = vi.fn((...args) => { startAtVal = args[0]; return chain; });
    chain.endAt = vi.fn().mockReturnValue(chain);
    chain.startAfter = vi.fn((...args) => {
      // O tie-breaker (ID do documento) é o último argumento passado pelo controlador
      const tieBreaker = args[args.length - 1];
      const id = typeof tieBreaker === 'string' ? tieBreaker : '';
      const match = id.match(/user-(\d+)/);
      if (match) offsetVal = parseInt(match[1], 10) + 1;
      return chain;
    });

    /**
     * @name Aplicar Filtros
     * @summary Motor de busca em memória.
     * @description Filtra e ordena a lista de resultados simulados baseado no estado da chain.
     * 
     * @params {any[]} baseResults - Coleção de documentos em estado bruto.
     * @returns {any[]} Resultados filtrados, ordenados e preparados para snapshot.
     * @example
     * const results = applyFilters(baseResults);
     */
    const applyFilters = (baseResults: any[]) => {
      let results = [...baseResults];

      // Aplicar Wheres
      for (const f of wheres) {
        results = results.filter(r => {
          const val = f.field.split('.').reduce((obj, key) => obj?.[key], r);
          if (f.op === '==') return val === f.val;
          if (f.op === '!=') return val !== f.val;
          if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(val);
          return true;
        });
      }

      // Aplicar Busca por Prefixo (startAt básico)
      if (startAtVal && typeof startAtVal === 'string') {
        const term = startAtVal.toLowerCase();
        results = results.filter(r => {
          const name = (r.friend?.displayName || r.displayName || '').toLowerCase();
          const nick = (r.friend?.nickname || r.nickname || '').toLowerCase();
          return name.includes(term) || nick.includes(term);
        });
      }

      // Aplicar Ordenação
      if (orders.length > 0) {
        results.sort((a, b) => {
          for (const o of orders) {
            const valA = o.field.split('.').reduce((obj, key) => obj?.[key], a);
            const valB = o.field.split('.').reduce((obj, key) => obj?.[key], b);
            if (valA < valB) return o.dir === 'asc' ? -1 : 1;
            if (valA > valB) return o.dir === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      return results;
    };

    chain.count = vi.fn(() => ({
      get: vi.fn(() => {
        const baseResults = state.queryResults[collectionName] || [];
        const filtered = applyFilters(baseResults);
        return Promise.resolve({ data: () => ({ count: filtered.length }) });
      })
    }));

    chain.get = vi.fn(() => {
      if (!state.queryCallCount[collectionName]) state.queryCallCount[collectionName] = 0;
      const idx = state.queryCallCount[collectionName]++;

      const specificResults = state.queryResults[`${collectionName}:${idx}`];
      if (specificResults) return Promise.resolve(makeQuerySnapshot(specificResults));

      const baseResults = state.queryResults[collectionName] || [];
      const filtered = applyFilters(baseResults);
      const sliced = filtered.slice(offsetVal, offsetVal + limitVal);

      return Promise.resolve(makeQuerySnapshot(sliced));
    });
    return chain;
  };

  /**
   * @name Mock CollectionRef
   * @summary Simula referência de coleção.
   * @description Cria uma referência de coleção simulada com suporte a queries encadeadas.
   * 
   * @params {string} name - Nome da coleção
   * @returns {Object} CollectionReference simulado
   * @example
   * const ref = makeCollectionRef("users");
   */
  const makeCollectionRef = (name: string) => {
    const chain = makeQueryChain(name);
    return {
      doc: vi.fn((id: string) => makeDocRef(name, id)),
      where: chain.where,
      limit: chain.limit,
      select: chain.select,
      orderBy: chain.orderBy,
      get: chain.get,
      add: vi.fn().mockResolvedValue({ id: 'mock-id' }),
      count: chain.count,
    };
  };

  /**
   * @name Mock Transaction
   * @summary Simulação de transações atômicas.
   * @description Implementa os métodos get, set, update e delete para simular transações do Firestore.
   * 
   * @returns {Object} Interface fluida da transação mockada
   * @example
   * const transaction = mockTransaction;
   */
  const mockTransaction = {
    get: vi.fn((ref: any) => {
      const data = state.docStore[ref.__path];
      return Promise.resolve(makeDocSnapshot(ref.__id, data));
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  /**
   * @name Mock WriteBatch
   * @summary Operações em lote simuladas.
   * @description Simula o comportamento do WriteBatch do Firestore, acumulando 
   * operações de escrita que são aplicadas em memória apenas no commit.
   * 
   * @returns {Object} Interface fluida do WriteBatch mockado
   * @example
   * const batch = mockBatch;
   */
  const mockBatch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  /**
   * @name Mock Firestore Database
   * @summary Ponto de entrada do banco simulado.
   * @description Provê métodos principais do Firestore (collection, transaction, batch) 
   * redirecionando-os para os mocks hoisted ({@link mockDb}, {@link mockTransaction}).
   * 
   * @returns {Object} Instância de banco de dados mockada
   * @example
   * const db = mockDb;
   */
  const mockDb: any = {
    collection: vi.fn((name: string) => makeCollectionRef(name)),
    runTransaction: vi.fn(async (cb: Function) => cb(mockTransaction)),
    batch: vi.fn(() => mockBatch),
  };

  return { state, mockDb, mockBatch, mockTransaction, makeCollectionRef, makeDocSnapshot };
});

// =============================================================================
// MOCKS DE MÓDULOS E MIDDLEWARES
// =============================================================================

/**
 * @name Mock Logger Functions
 * @summary Supressão de saída de console.
 * @description Evita ruídos de log no terminal durante a execução dos testes ao silenciar firebase-functions/logger.
 */
vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

/**
 * @name Mock Firebase Admin
 * @summary SDK Administrativo simulado.
 * @description Simula o SDK Admin do Firebase, incluindo instâncias de Firestore, Timestamp e FieldValue.
 * 
 * @returns {Object} Interface administrativa mockada
 */
vi.mock('firebase-admin', () => {
  const firestoreFn: any = () => mockDb;
  firestoreFn.Timestamp = {
    now: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date() }),
  };
  firestoreFn.FieldValue = {
    increment: (n: number) => ({ __increment: n }),
  };

  const authMock = () => ({ verifySessionCookie: vi.fn() });
  const databaseMock = () => ({
    ref: vi.fn(() => ({
      update: vi.fn().mockResolvedValue(undefined),
      push: vi.fn(() => ({ key: 'mock-key', set: vi.fn().mockResolvedValue(undefined) })),
      set: vi.fn().mockResolvedValue(undefined)
    })),
    ServerValue: { TIMESTAMP: { '.sv': 'timestamp' }, increment: (n: number) => ({ '.sv': { increment: n } }) }
  });
  const storageMock = () => ({
    bucket: vi.fn(() => ({
      name: 'mock-bucket',
      file: vi.fn(() => ({
        getSignedUrl: vi.fn().mockResolvedValue(['https://mock-signed-url'])
      }))
    }))
  });

  return {
    default: {
      apps: [{}],
      initializeApp: vi.fn(),
      firestore: firestoreFn,
      auth: authMock,
      database: databaseMock,
      storage: storageMock,
    },
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    auth: authMock,
    database: databaseMock,
    storage: storageMock,
  };
});

/**
 * @name Mock Auth Middleware
 * @summary Simula autenticação de usuário.
 * @description Garante que o usuário 'current-user' esteja sempre autenticado para as rotas da API durante os testes.
 * 
 * @params {Request} req - Requisição Express
 * @params {Response} _res - Resposta Express
 * @params {NextFunction} next - Função next
 * @returns {void}
 * @example
 * checkAuth(req, _res, next);
 */
vi.mock('../middleware/auth.middleware', () => ({

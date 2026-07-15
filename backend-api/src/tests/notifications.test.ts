// =============================================================================
// CONFIGURAÇÕES E IMPORTS DE TESTE (NOTIFICAÇÕES)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { invalidatePattern } from '../lib/cache';

// =============================================================================
// MOCKS ELEVADOS (HOISTED)
// =============================================================================

/**
 * @name Mock Factory Notifications
 * @summary Gerador de ambiente de notificações.
 * @description Mocks elevados para simular o comportamento do Firestore e gerenciar o estado global de notificações.
 * Centraliza o estado simulado do banco de dados (docStore) e os resultados de query.
 * 
 * @returns {Object} Interface com mocks e helpers para testes
 */
const { state, mockDb, mockBatch, makeCollectionRef, makeDocSnapshot } = vi.hoisted(() => {
  /**
   * @name Estado Global de Notificações
   * @summary Repositório de dados em memória.
   * @description Centraliza documentos e resultados de consulta para os mocks do Firestore.
   * 
   * @property {Record<string, any>} docStore - Armazena os dados brutos das notificações indexados pelo caminho (ex: 'notifications/id').
   * @property {Record<string, any[]>} queryResults - Armazena resultados pré-definidos para simular listagens e contagens.
   * @property {Record<string, number>} queryCallCount - Contador para permitir que queries sequenciais na mesma coleção retornem dados distintos.
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
   */
  const makeDocSnapshot = (id: string, data: any) => ({
    exists: data !== undefined,
    data: () => data,
    id,
  });

  /**
   * @name Helper Query Snapshot
   * @summary Simula lista de notificações.
   * @description Cria um objeto que simula um QuerySnapshot do Firestore para notificações.
   * 
   * @params {Array<Record<string, any>>} docs - Lista de dados brutos
   * @returns {Object} QuerySnapshot simulado
   */
  const makeQuerySnapshot = (docs: Array<Record<string, any>>) => ({
    docs: docs.map(d => ({
      id: d.id,
      data: () => d,
      exists: true,
      ref: { __path: `notifications/${d.id}`, __id: d.id }
    })),
    empty: docs.length === 0,
    size: docs.length,
  });

  /**
   * @name Helper Doc Reference
   * @summary Simula referência de documento.
   * @description Cria uma referência de documento (DocumentReference) do Firestore com suporte a get, update e delete.
   * 
   * @params {string} collection - Nome da coleção
   * @params {string} id - ID do documento
   * @returns {Object} DocumentReference simulado
   * @example
   * const ref = makeDocRef("notifications", "n1");
   */
  const makeDocRef = (collection: string, id: string) => ({
    __path: `${collection}/${id}`,
    __id: id,
    get: vi.fn(() => {
      const data = state.docStore[`${collection}/${id}`];
      return Promise.resolve(makeDocSnapshot(id, data));
    }),
    update: vi.fn((data: any) => {
      if (state.docStore[`${collection}/${id}`]) {
        state.docStore[`${collection}/${id}`] = { ...state.docStore[`${collection}/${id}`], ...data };
      }
      return Promise.resolve();
    }),
    delete: vi.fn(() => {
      delete state.docStore[`${collection}/${id}`];
      return Promise.resolve();
    }),
  });

  /**
   * @name Motor de Consulta (Query Engine)
   * @summary Simulação de queries do Firestore em memória.
   * @description Resolve lógica de filtragem (where), ordenação (orderBy) e paginação (limit/offset/startAfter).
   * 
   * @params {string} collectionName - Identificador da coleção no docStore.
   * @returns {Object} Interface fluida para encadeamento de métodos do Firestore.
   */
  const makeQueryChain = (collectionName: string) => {
    let limitVal = 1000;
    let offsetVal = 0;
    const wheres: Array<{ field: string; op: string; val: any }> = [];
    const orders: Array<{ field: string; dir: string }> = [];
    let startAfterVal: any = null;

    const chain: any = {};
    chain.where = vi.fn((field, op, val) => { wheres.push({ field, op, val }); return chain; });
    chain.limit = vi.fn((l) => { limitVal = l; return chain; });
    chain.offset = vi.fn((o) => { offsetVal = o; return chain; });
    chain.orderBy = vi.fn((field, dir = 'asc') => { orders.push({ field, dir }); return chain; });
    chain.startAfter = vi.fn((...args) => { startAfterVal = args; return chain; });

    /**
     * @name Aplicar Filtros
     * @summary Lógica de processamento de query em memória.
     * @description Executa filtragem por campos, ordenação customizada (com suporte a timestamps) 
     * e paginação via cursor (startAfter) sobre a coleção simulada.
     * 
     * @params {any[]} baseResults - Documentos da coleção
     * @returns {any[]} Resultados processados
     */
    const applyFilters = (baseResults: any[]) => {
      let results = [...baseResults];

      // Aplicar Wheres
      for (const f of wheres) {
        results = results.filter(r => {
          const val = f.field.split('.').reduce((obj, key) => obj?.[key], r);
          if (f.op === '==') return val === f.val;
          if (f.op === '!=') return val !== f.val;
          return true;
        });
      }

      // Aplicar Ordenação
      if (orders.length > 0) {
        results.sort((a, b) => {
          for (const o of orders) {
            const valA = o.field.split('.').reduce((obj, key) => obj?.[key], a);
            const valB = o.field.split('.').reduce((obj, key) => obj?.[key], b);

            // Tratamento especial para timestamps em memória
            const getTime = (v: any) => v?.toMillis ? v.toMillis() : new Date(v).getTime();

            if (getTime(valA) < getTime(valB)) return o.dir === 'asc' ? -1 : 1;
            if (getTime(valA) > getTime(valB)) return o.dir === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      // Aplicar Cursor (startAfter baseado em ID)
      if (startAfterVal) {
        const lastId = startAfterVal[startAfterVal.length - 1]; // Assume que o último valor do cursor é o ID
        const index = results.findIndex(r => r.id === lastId);
        if (index !== -1) results = results.slice(index + 1);
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
   * @description Cria uma referência de coleção simulada específica para o fluxo de notificações.
   * 
   * @params {string} name - Nome da coleção
   * @returns {Object} CollectionReference simulado
   */
  const makeCollectionRef = (name: string) => {
    const chain = makeQueryChain(name);
    return {
      doc: vi.fn((id: string) => makeDocRef(name, id)),
      where: chain.where,
      limit: chain.limit,
      orderBy: chain.orderBy,
      get: chain.get,
      count: chain.count,
    };
  };

  /**
   * @name Mock WriteBatch
   * @summary Operações em lote para notificações.
   * @description Simula operações em lote, essencial para funcionalidades como "Marcar todas como lidas" 
   * que exigem atomicidade entre múltiplos documentos.
   * 
   * @returns {Object} Interface do WriteBatch mockado
   */
  const mockBatch = {
    update: vi.fn((ref: any, data: any) => {
      const path = ref.__path;
      if (state.docStore[path]) {
        state.docStore[path] = { ...state.docStore[path], ...data };
      }
    }),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  /**
   * @name Mock Firestore Database
   * @summary Ponto de entrada do banco simulado.
   * @description Provê métodos principais do Firestore (collection, batch) redirecionando para os mocks apropriados.
   * 
   * @returns {Object} Instância de banco de dados mockada
   * @example
   * const db = mockDb;
   */
  const mockDb: any = {
    collection: vi.fn((name: string) => makeCollectionRef(name)),
    batch: vi.fn(() => mockBatch),
  };

  return { state, mockDb, mockBatch, makeCollectionRef, makeDocSnapshot };
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
    now: () => ({
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now()
    }),
    fromMillis: (ms: number) => ({
      seconds: Math.floor(ms / 1000),
      nanoseconds: (ms % 1000) * 1e6,
      toDate: () => new Date(ms),
      toMillis: () => ms
    })
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
    admin: { firestore: firestoreFn, auth: authMock, database: databaseMock, storage: storageMock },
    db: mockDb,
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
 */
vi.mock('../middleware/auth.middleware', () => ({

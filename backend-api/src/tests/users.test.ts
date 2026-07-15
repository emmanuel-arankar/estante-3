// =============================================================================
// CONFIGURAÇÕES E IMPORTS DE TESTE (USUÁRIOS)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { admin, db } from '../firebase';
import { invalidatePattern } from '../lib/cache';

// =============================================================================
// MOCKS ELEVADOS (HOISTED)
// =============================================================================

/**
 * @name Mock Factory Users
 * @summary Gerador de ambiente de usuários.
 * @description Mocks elevados para simular o comportamento do Firestore e gerenciar o estado global de usuários.
 * Centraliza o estado simulado do banco de dados (docStore) e os resultados de query.
 * 
 * @returns {Object} Interface com mocks e helpers para testes de usuários
 */
const { state, mockDb, mockBatch, transactionMock, makeCollectionRef, makeDocSnapshot } = vi.hoisted(() => {
  /**
   * @name Estado Global de Usuários
   * @summary Repositório de dados em memória.
   * @description Centraliza documentos de perfil, avatares e resultados de busca para os mocks do Firestore.
   * 
   * @property {Record<string, any>} docStore - Armazena os dados brutos (perfis, blocos, avatares) por caminho.
   * @property {Record<string, any[]>} queryResults - Resultados pré-definidos para simular buscas e listagens.
   * @property {Record<string, number>} queryCallCount - Contador para controle de paginação em queries simuladas.
   */
  const state = {
    docStore: {} as Record<string, any>,
    queryResults: {} as Record<string, any[]>,
    queryCallCount: {} as Record<string, number>,
  };

  /**
   * @name Helper Snapshot
   * @summary Cria snapshot de usuário.
   * @description Cria um objeto que simula um DocumentSnapshot do Firestore para perfis.
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
   * @summary Simula lista de usuários.
   * @description Cria um objeto que simula um QuerySnapshot do Firestore para pesquisas e listagens.
   * 
   * @params {Array<Record<string, any>>} docs - Lista de dados brutos
   * @returns {Object} QuerySnapshot simulado
   * @example
   * const snapshot = makeQuerySnapshot([
   *  { id: 'u1', nickname: 'alice', displayName: 'Alice Silva' },
   *  { id: 'u2', nickname: 'bob', displayName: 'Bob Silva' },
   * ]);
   */
  const makeQuerySnapshot = (docs: Array<Record<string, any>>) => ({
    docs: docs.map(d => ({
      id: d.id,
      data: () => d,
      exists: true,
      ref: { __path: `users/${d.id}`, __id: d.id }
    })),
    empty: docs.length === 0,
    size: docs.length,
  });

  /**
   * @name Helper Doc Reference
   * @summary Simula referência de documento.
   * @description Cria uma referência de documento (DocumentReference) do Firestore com suporte a get, set e update.
   * 
   * @params {string} collection - Nome da coleção
   * @params {string} id - ID do documento
   * @returns {Object} DocumentReference simulado
   * @example
   * const ref = makeDocRef("users", "u1");
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
    set: vi.fn((data: any) => {
      state.docStore[`${collection}/${id}`] = data;
      return Promise.resolve();
    }),
  });

  /**
   * @name Motor de Consulta (Query Engine)
   * @summary Simulação de buscas do Firestore.
   * @description Resolve lógica de filtragem exata (where) e busca textual por prefixo (startAt/endAt).
   * 
   * @params {string} collectionName - Identificador da coleção no docStore.
   * @returns {Object} Interface fluida para encadeamento de métodos do Firestore.
   * @example
   * const chain = makeQueryChain('users');
   * chain.where('nickname', '==', 'alice').get();
   */
  const makeQueryChain = (collectionName: string) => {
    let limitVal = 1000;
    const wheres: Array<{ field: string; op: string; val: any }> = [];
    const orders: Array<{ field: string; dir: string }> = [];
    let startAtVal: any = null;

    const chain: any = {};
    chain.where = vi.fn((field, op, val) => { wheres.push({ field, op, val }); return chain; });
    chain.limit = vi.fn((l) => { limitVal = l; return chain; });
    chain.orderBy = vi.fn((field, dir = 'asc') => { orders.push({ field, dir }); return chain; });
    chain.startAt = vi.fn((...args) => { startAtVal = args[0]; return chain; });
    chain.endAt = vi.fn().mockReturnValue(chain);

    /**
     * @name Aplicar Filtros
     * @summary Motor de busca de usuários em memória.
     * @description Executa filtragem por campos exatos e busca textual por prefixo (startsWith) 
     * em múltiplos campos (displayName, nickname, displayNameLower).
     * 
     * @params {any[]} baseResults - Usuários da coleção simulada
     * @returns {any[]} Resultados filtrados
     * @example
     * const filtered = applyFilters(state.docStore['users']);
     */
    const applyFilters = (baseResults: any[]) => {
      let results = [...baseResults];

      // Aplicar Wheres
      for (const f of wheres) {
        results = results.filter(r => {
          const val = f.field.split('.').reduce((obj, key) => obj?.[key], r);
          if (f.op === '==') return val === f.val;
          if (f.op === '>=') return val >= f.val;
          if (f.op === '<=') return val <= f.val;
          if (f.op === 'array-contains') return Array.isArray(val) && val.includes(f.val);
          return true;
        });
      }

      // Aplicar Busca por Prefixo (startAt básico)
      if (startAtVal && typeof startAtVal === 'string') {
        const term = startAtVal.toLowerCase();
        results = results.filter(r => {
          const name = (r.displayName || '').toLowerCase();
          const nick = (r.nickname || '').toLowerCase();
          const nameLower = (r.displayNameLower || '').toLowerCase();
          return name.startsWith(term) || nick.startsWith(term) || nameLower.startsWith(term);
        });
      }

      return results;
    };

    chain.get = vi.fn(() => {
      if (!state.queryCallCount[collectionName]) state.queryCallCount[collectionName] = 0;
      const idx = state.queryCallCount[collectionName]++;

      const specificResults = state.queryResults[`${collectionName}:${idx}`];
      if (specificResults) return Promise.resolve(makeQuerySnapshot(specificResults));

      const baseResults = state.queryResults[collectionName] || [];
      const filtered = applyFilters(baseResults);
      const sliced = filtered.slice(0, limitVal);

      return Promise.resolve(makeQuerySnapshot(sliced));
    });
    return chain;
  };

  /**
   * @name Mock Transaction
   * @summary Simulação de transações do Firestore.
   */
  const transactionMock = {
    get: vi.fn((ref: any) => {
      const data = state.docStore[ref.__path];
      return Promise.resolve(makeDocSnapshot(ref.__id, data));
    }),
    set: vi.fn((ref: any, data: any) => {
      state.docStore[ref.__path] = data;
      return transactionMock;
    }),
    update: vi.fn((ref: any, data: any) => {
      if (state.docStore[ref.__path]) {
        state.docStore[ref.__path] = { ...state.docStore[ref.__path], ...data };
      }
      return transactionMock;
    }),
    delete: vi.fn(),
  };

  /**
   * @name Mock CollectionRef
   * @summary Simula referência de coleção.
   * @description Cria uma referência de coleção simulada com suporte a busca por prefixo.
   * 
   * @params {string} name - Nome da coleção
   * @returns {Object} CollectionReference simulado
   * @example
   * const ref = makeCollectionRef('users');
   * ref.doc('u1').get();
   */
  const makeCollectionRef = (name: string) => {
    const chain = makeQueryChain(name);
    return {
      doc: vi.fn((id: string) => makeDocRef(name, id)),
      where: chain.where,
      limit: chain.limit,
      orderBy: chain.orderBy,
      get: chain.get,
    };
  };

  /**
   * @name Mock WriteBatch
   * @summary Operações em lote para perfis.
   * @description Simula o comportamento do WriteBatch para operações que envolvem 
   * atualizações massivas ou modificações em lote de perfis e avatares.
   * 
   * @returns {Object} Interface do WriteBatch mockado
   * @example
   * const batch = mockBatch();
   * batch.set(ref, data);
   * batch.commit();
   */
  const mockBatch = {
    set: vi.fn((ref, data) => {
      state.docStore[ref.__path] = data;
    }),
    update: vi.fn((ref, data) => {
      if (state.docStore[ref.__path]) {
        state.docStore[ref.__path] = { ...state.docStore[ref.__path], ...data };
      }
    }),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  /**
   * @name Ponto de Entrada do BD
   * @summary Mock global do Firestore.
   * @description Provê acesso às coleções e operações em lote (WriteBatch) simuladas.
   * 
   * @returns {Object} Instância de Firestore mockada
   * @example
   * const db = mockDb;
   */
  const mockDb: any = {
    collection: vi.fn((name: string) => makeCollectionRef(name)),
    batch: vi.fn(() => mockBatch),
    runTransaction: vi.fn((callback) => callback(transactionMock)),
  };

  return { state, mockDb, mockBatch, transactionMock, makeCollectionRef, makeDocSnapshot };
});

// =============================================================================
// MOCKS DE MÓDULOS E MIDDLEWARES
// =============================================================================

/**
 * @name Silenciador de Logs
 * @summary Mock Logger.
 * @description Inibe a saída de logs no console durante a execução dos testes para manter o terminal limpo.
 */
vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

/**
 * @name Mock SDK Firebase Admin
 * @summary Administrativo simulado.
 * @description Provê instâncias mockadas de Firestore, Timestamp e FieldValue necessárias para o backend.
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
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime()
    }),
  };
  firestoreFn.FieldValue = {
    increment: (n: number) => ({ __increment: n }),
    serverTimestamp: () => new Date().toISOString(),
    arrayUnion: (val: any) => ({ __op: 'union', val }),
    arrayRemove: (val: any) => ({ __op: 'remove', val }),
  };

  const authMock = {
    verifySessionCookie: vi.fn(),
    createUser: vi.fn(),
    createCustomToken: vi.fn(),
    deleteUser: vi.fn(),
  };

  const authMockExtended = {
    ...authMock,
    updateUser: vi.fn().mockResolvedValue({}),
    verifySessionCookie: vi.fn(),
  };

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
      auth: () => authMockExtended,
      database: databaseMock,
      storage: storageMock,
    },
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    auth: () => authMockExtended,
    database: databaseMock,
    storage: storageMock,
  };
});

/**
 * @name Mock Middleware de Autenticação
 * @summary Usuário logado persistente.
 * @description Garante que todas as requisições API sejam processadas com o UID 'current-user'.
 */
vi.mock('../middleware/auth.middleware', () => ({

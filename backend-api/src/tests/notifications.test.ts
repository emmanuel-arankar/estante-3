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
  checkAuth: vi.fn((req: any, _res: any, next: any) => {
        req.user = { uid: 'current-user' };
        next();
    }),
    checkAuthOptional: vi.fn((req: any, _res: any, next: any) => {
    req.user = { uid: 'current-user' };
    next();
  }),
}));

// ==== ==== SETUP E CICLO DE VIDA ==== ====

/**
 * @name Reset de Ambiente
 * @summary Limpeza entre ciclos de teste.
 * @description Reinicia o banco de dados simulado e limpa o cache local para garantir isolamento total entre os cenários.
 */
beforeEach(async () => {
  state.docStore = {};
  state.queryResults = {};
  state.queryCallCount = {};
  vi.clearAllMocks();
  await invalidatePattern('*');
});

// ==== ==== CASOS DE TESTE (NOTIFICATIONS) ==== ====

/**
 * @name Helper Criar Notificação
 * @summary Gera notificação mockada.
 * @description Gera um objeto de notificação padrão para injeção no docStore.
 * 
 * @params {string} id - ID da notificação
 * @params {string} [type] - Tipo da notificação
 * @params {boolean} [read] - Status de leitura
 * @returns {Object} Notificação para docStore
 * @example
 * state.docStore['notifications/n1'] = makeNotification('n1', 'friend_request');
 */
const makeNotification = (id: string, type = 'friend_request', read = false) => ({
  id,
  userId: 'current-user',
  type,
  actorId: 'other-user',
  actorName: 'Other User',
  read,
  createdAt: { toDate: () => new Date(), toMillis: () => Date.now(), seconds: 123, nanoseconds: 0 },
});


/**
 * @name Listagem de Notificações
 * @summary Visualização do feed de alertas.
 * @description Conjunto de testes para a recuperação paginada de notificações, incluindo filtros de lidas/não lidas.
 */
describe('GET /api/notifications', () => {
  /**
   * @test Lista Vazia
   * @summary Ausência de notificações.
   * @description Garante que a API retorne uma lista vazia e metadados de paginação zerados quando o usuário não possui alertas.
   * 
   * @example
   * const res = await request(app).get('/api/notifications');
   * expect(res.body.data.data).toEqual([]);
   */
  it('deve retornar lista vazia quando não há notificações', async () => {
    // [ARRANGE] Mockar resultado de query vazia
    state.queryResults['notifications'] = [];

    // [ACT] Chamar endpoint de listagem {@link listNotificationsQuerySchema}
    const res = await request(app).get('/api/notifications');

    // [ASSERT] Validar resposta padrão para lista vazia
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });

  /**
   * @test Paginação de Notificações
   * @summary Controle de fluxo de dados.
   * @description Verifica se o sistema respeita os limites de página e retorna os metadados de navegação corretos.
   * 
   * @example
   * const res = await request(app).get('/api/notifications?page=1&limit=2');
   * expect(res.body.data.data).toHaveLength(2);
   */
  it('deve listar notificações com paginação', async () => {
    // [ARRANGE] Preparar múltiplas notificações no estado
    state.queryResults['notifications'] = [
      makeNotification('n1'),
      makeNotification('n2'),
      makeNotification('n3'),
    ];

    // [ACT] Solicitar página 1 com limite de 2 via {@link listNotificationsQuerySchema}
    const res = await request(app).get('/api/notifications?page=1&limit=2');

    // [ASSERT] Validar dados da página e metadados de paginação
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.hasMore).toBe(true);
  });

  /**
   * @test Listagem Filtrada
   * @summary Filtro de notificações não lidas.
   * @description Garante que o parâmetro 'unreadOnly' funcione corretamente no motor de query simulado.
   * 
   * @example
   * const res = await request(app).get('/api/notifications?unreadOnly=true');
   * expect(res.body.data.data[0].read).toBe(false);
   */
  it('deve filtrar apenas notificações não lidas', async () => {
    state.queryResults['notifications'] = [
      makeNotification('n1', 'type1', true),
      makeNotification('n2', 'type2', false),
    ];

    const res = await request(app).get('/api/notifications?unreadOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].id).toBe('n2');
  });
});

/**
 * @name Marcação de Leitura
 * @summary Gestão de status individual.
 * @description Valida a alteração do estado de notificação para 'lida' e as respectivas permissões de segurança.
 */
describe('POST /api/notifications/:notificationId/read', () => {
  /**
   * @test Marcar como Lido
   * @summary Atualização individual de status.
   * @description Valida se o status 'read' é alterado para true no banco de dados após a requisição.
   * 
   * @example
   * const res = await request(app).post('/api/notifications/n1/read');
   * expect(state.docStore['notifications/n1'].read).toBe(true);
   */
  it('deve marcar notificação como lida', async () => {
    state.docStore['notifications/n1'] = { userId: 'current-user', read: false };

    const res = await request(app).post('/api/notifications/n1/read');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('lida');
    expect(state.docStore['notifications/n1'].read).toBe(true);
  });

  /**
   * @test Notificação Inexistente
   * @summary Erro 404 para ID inválido.
   * @description Garante que o sistema informe erro quando tentam marcar como lida uma notificação que não existe no banco.
   * 
   * @example
   * const res = await request(app).post('/api/notifications/invalid/read');
   * expect(res.status).toBe(404);
   */
  it('deve retornar 404 para notificação inexistente', async () => {
    const res = await request(app).post('/api/notifications/invalid/read');
    expect(res.status).toBe(404);
  });

  /**
   * @test Permissão de Leitura
   * @summary Bloqueio de acesso indevido.
   * @description Verifica se um usuário é impedido de marcar como lida uma notificação que pertence a outro UID (erro 403).
   * 
   * @example
   * const res = await request(app).post('/api/notifications/other_user_notif/read');
   * expect(res.status).toBe(403);
   */
  it('deve retornar 403 se a notificação não pertencer ao usuário', async () => {
    state.docStore['notifications/n1'] = { userId: 'other-user', read: false };

    const res = await request(app).post('/api/notifications/n1/read');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('permissão');
  });
});

/**
 * @name Leitura em Massa
 * @summary Processamento atômico de alertas.
 * @description Conjunto de testes para a funcionalidade de marcar todas as notificações do usuário como lidas simultaneamente.
 */
describe('POST /api/notifications/mark-all-read', () => {
  /**
   * @test Marcar Todas como Lidas
   * @summary Atualização massiva de status.
   * @description Simula o processamento em lote para atualizar todas as notificações pendentes do usuário em uma única operação.
   * 
   * @example
   * const res = await request(app).post('/api/notifications/mark-all-read');
   * expect(res.body.data.count).toBe(2);
   */
  it('deve marcar todas as notificações como lidas', async () => {
    state.queryResults['notifications'] = [
      { id: 'n1', data: () => ({ userId: 'current-user', read: false }), ref: { __path: 'notifications/n1' } },
      { id: 'n2', data: () => ({ userId: 'current-user', read: false }), ref: { __path: 'notifications/n2' } },
    ];
    // Força resultado específico para a consulta interna de mark-all-read
    state.queryResults['notifications:0'] = state.queryResults['notifications'];

    // We also need docStore to reflect the changes if we want to verify them there
    state.docStore['notifications/n1'] = { userId: 'current-user', read: false };
    state.docStore['notifications/n2'] = { userId: 'current-user', read: false };

    const res = await request(app).post('/api/notifications/mark-all-read');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(state.docStore['notifications/n1'].read).toBe(true);
    expect(state.docStore['notifications/n2'].read).toBe(true);
  });
});

/**
 * @name Exclusão de Notificações
 * @summary Limpeza de histórico.
 * @description Garante que usuários possam remover notificações de seu feed de forma segura.
 */
describe('DELETE /api/notifications/:notificationId', () => {
  /**
   * @test Exclusão de Notificação
   * @summary Remoção individual.
   * @description Garante que a notificação seja removida do docStore após a chamada de exclusão.
   * 
   * @example
   * const res = await request(app).delete('/api/notifications/n1');
   * expect(state.docStore['notifications/n1']).toBeUndefined();
   */
  it('deve excluir notificação com sucesso', async () => {
    state.docStore['notifications/n1'] = { userId: 'current-user' };

    const res = await request(app).delete('/api/notifications/n1');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('sucesso');
    expect(state.docStore['notifications/n1']).toBeUndefined();
  });
});

/**
 * @name Contagem de Notificações
 * @summary Indicador de pendências.
 * @description Testa a precisão do contador de notificações não lidas para exibição em badges de UI.
 */
describe('GET /api/notifications/unread-count', () => {
  /**
   * @test Contagem de Pendentes
   * @summary Totalizador de não lidas.
   * @description Valida se a API retorna o número exato de notificações com status 'read: false'.
   * 
   * @example
   * const res = await request(app).get('/api/notifications/unread-count');
   * expect(res.body.data.count).toBe(2);
   */
  it('deve retornar a contagem correta de notificações não lidas', async () => {
    state.queryResults['notifications'] = [
      makeNotification('n1', 'type1', false),
      makeNotification('n2', 'type2', false),
      makeNotification('n3', 'type3', true),
    ];

    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });
});

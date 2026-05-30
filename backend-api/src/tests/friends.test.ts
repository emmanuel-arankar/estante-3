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

beforeEach(async () => {
  // Reinicia o banco de dados e os contadores de chamada para garantir isolamento
  state.docStore = {};
  state.queryResults = {};
  state.queryCallCount = {};
  vi.clearAllMocks();

  // Invalida o cache local para evitar poluição entre cenários de teste
  await invalidatePattern('*');

  // Redefine implementações padrão dos mocks principais
  mockDb.collection.mockImplementation((name: string) => makeCollectionRef(name));
  mockDb.runTransaction.mockImplementation(async (cb: Function) => cb(mockTransaction));
  mockDb.batch.mockImplementation(() => mockBatch);
  mockBatch.commit.mockResolvedValue(undefined);
  mockTransaction.get.mockImplementation((ref: any) => {
    const data = state.docStore[ref.__path];
    return Promise.resolve(makeDocSnapshot(ref.__id, data));
  });
});

// ==== ==== CASOS DE TESTE (FRIENDS) ==== ====

/**
 * @name Busca de Amigos
 * @summary Descoberta de perfis.
 * @description Conjunto de testes para a funcionalidade de localização de usuários via termo de busca (nickname ou nome).
 */
describe('GET /api/findFriends', () => {
  /**
   * @test Termo Ausente
   * @summary Validação de parâmetro obrigatório.
   * @description Verifica se a API rejeita requisições sem o termo de busca searchTerm.
   * 
   * @example
   * const res = await request(app).get('/api/findFriends');
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 se searchTerm estiver ausente', async () => {
    const res = await request(app).get('/api/findFriends');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Termo Mínimo
   * @summary Proteção contra buscas genéricas.
   * @description Garante que o sistema exija ao menos 3 caracteres para evitar overhead de busca.
   * 
   * @example
   * const res = await request(app).get('/api/findFriends?searchTerm=a');
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 se searchTerm for muito curto', async () => {
    const res = await request(app).get('/api/findFriends?searchTerm=a');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Busca com Sucesso
   * @summary Localização de perfis compatíveis.
   * @description Valida se a busca textual no Firestore retorna corretamente os usuários mockados.
   * 
   * @example
   * const res = await request(app).get('/api/findFriends?searchTerm=João');
   * expect(res.body[0].displayName).toBe('João Silva');
   */
  it('deve retornar usuários correspondentes', async () => {
    // [ARRANGE] Preparar estado simulado do banco
    state.queryResults['users'] = [
      { id: 'user-2', displayName: 'João Silva', nickname: 'joao', email: 'joao@test.com' },
    ];

    // [ACT] Chamar a API de busca de amigos {@link findFriendsQuerySchema}
    const res = await request(app).get('/api/findFriends?searchTerm=João');

    // [ASSERT] Validar status e conteúdo do retorno
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].displayName).toBe('João Silva');
  });

  /**
   * @test Exclusão do Usuário Logado
   * @summary Prevenção de auto-inclusão.
   * @description Garante que o usuário autenticado não apareça nos resultados da busca de amigos.
   * 
   * @example
   * const res = await request(app).get('/api/findFriends?searchTerm=test');
   * expect(res.body.map((u: any) => u.id)).not.toContain('current-user');
   */
  it('não deve incluir o usuário logado nos resultados', async () => {
    state.queryResults['users'] = [
      { id: 'current-user', displayName: 'Eu Mesmo', nickname: 'eu' },
      { id: 'user-2', displayName: 'Amigo', nickname: 'amigo' },
    ];

    const res = await request(app).get('/api/findFriends?searchTerm=test');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).not.toContain('current-user');
    expect(ids).toContain('user-2');
  });
});

/**
 * @name Solicitação de Amizade
 * @summary Início de relação.
 * @description Testes para o fluxo de envio de pedidos de amizade entre usuários.
 */
describe('POST /api/friendships/request', () => {
  /**
   * @name Helper Dados de Usuário
   * @summary Gera usuário mockado.
   * @description Cria um objeto de usuário mockado com campos padrão.
   * 
   * @params {string} name - Nome de exibição
   * @returns {Object} Perfil de usuário para docStore
   * @example
   * state.docStore['users/u1'] = mockUserData('Alice');
   */
  const mockUserData = (name: string) => ({
    displayName: name,
    nickname: name.toLowerCase(),
    photoURL: null,
    email: `${name.toLowerCase()}@test.com`,
    bio: '',
    location: '',
    joinedAt: { seconds: 1000 },
    lastActive: null,
  });

  /**
   * @test Destinatário Ausente
   * @summary Rejeição de requisição sem ID.
   * @description Garante que a API retorne erro 400 caso o corpo da requisição não contenha 'targetUserId'.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/request').send({});
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 se targetUserId estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/request').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Auto-Solicitação
   * @summary Impedimento de amizade consigo mesmo.
   * @description Verifica se a lógica de negócio impede que um usuário envie uma solicitação para o seu próprio UID.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'current-user' });
   * expect(res.body.error).toContain('si mesmo');
   */
  it('deve retornar 400 ao enviar solicitação para si mesmo', async () => {
    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'current-user' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('si mesmo');
  });

  /**
   * @test Conflito de Amizade
   * @summary Prevenção de duplicidade.
   * @description Simula uma relação já existente no Firestore e garante o retorno 409 Conflict.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
   * expect(res.status).toBe(409);
   */
  it('deve retornar 409 se amizade já existir', async () => {
    state.docStore['friendships/current-user_target-user'] = {
      userId: 'current-user',
      friendId: 'target-user',
      status: 'pending',
    };

    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('já existe');
  });

  /**
   * @test Solicitação Bem-sucedida
   * @summary Fluxo de criação de pedido.
   * @description Valida a persistência da solicitação e o disparo de contadores via transação.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
   * expect(res.status).toBe(201);
   */
  it('deve criar solicitação de amizade com sucesso', async () => {
    state.docStore['users/current-user'] = mockUserData('CurrentUser');
    state.docStore['users/target-user'] = mockUserData('TargetUser');

    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
    expect(res.status).toBe(201);
    expect(res.body.data.message).toContain('sucesso');
    expect(mockTransaction.set).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  });

  /**
   * @test Bloqueio de Usuário
   * @summary Prevenção de assédio/stalking.
   * @description Garante que a solicitação de amizade falhe com 403 se houver um bloqueio entre os usuários.
   */
  it('deve retornar 403 se houver bloqueio entre os usuários', async () => {
    // Simula que o usuário atual bloqueou o alvo
    state.docStore['blocks/current-user_target-user'] = { createdAt: new Date() };

    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
    // Reiniciar Mock do admin SDK para garantir isolamento.
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('bloqueio');
  });
});

/**
 * @name Aceitar Amizade
 * @summary Estabelecimento de vínculo.
 * @description Testes para a aprovação de pedidos de amizade recebidos, incluindo validações de posse e status.
 */
describe('POST /api/friendships/:friendshipId/accept', () => {
  /**
   * @test Permissão de Aceite
   * @summary Segurança de posse da relação.
   * @description Verifica se um usuário tenta aceitar uma amizade que não pertence a ele.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/other-user_friend/accept');
   * expect(res.status).toBe(403);
   * expect(res.body.error).toContain('permissão');
   */
  it('deve retornar 403 se o usuário não for dono da amizade', async () => {
    const res = await request(app).post('/api/friendships/other-user_friend/accept');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('permissão');
  });

  /**
   * @test Solicitação Inexistente
   * @summary Validação de ID de relação.
   * @description Garante erro 400 ao tentar aceitar uma amizade que não possui registro no banco.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/invalid_id/accept');
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 se a solicitação não existir', async () => {
    const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não encontrada');
  });

  /**
   * @test Status Não Pendente
   * @summary Validação de estado atual.
   * @description Impede o aceite de amizades que já foram processadas (status != 'pending').
   * 
   * @example
   * const res = await request(app).post('/api/friendships/accepted_id/accept');
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 se a solicitação não estiver pendente', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'accepted',
      requestedBy: 'friend-user',
    };
    state.docStore['friendships/friend-user_current-user'] = {
      status: 'accepted',
      requestedBy: 'friend-user',
    };

    const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pendente');
  });

  /**
   * @test Auto-Aceite Bloqueado
   * @summary Prevenção de manipulação.
   * @description Garante que o usuário que enviou o pedido não consiga aceitá-lo sozinho.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/my_sent_id/accept');
   * expect(res.body.error).toContain('própria');
   */
  it('deve retornar 400 se tentar aceitar própria solicitação', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };
    state.docStore['friendships/friend-user_current-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };

    const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('própria');
  });

  /**
   * @test Aceite com Sucesso
   * @summary Conversão de pedido em amizade.
   * @description Valida a transição de status para 'accepted' e o incremento dos contadores de ambos os usuários.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
   * expect(res.status).toBe(200);
   * 
   * @note Lógica de contadores (Aceite):
   * - 2 atualizações de documentos de amizade (bidirecional).
   * - 2 atualizações de contadores (remetente e destinatário).
   */
  it('deve aceitar solicitação com sucesso', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'friend-user',
    };
    state.docStore['friendships/friend-user_current-user'] = {
      status: 'pending',
      requestedBy: 'friend-user',
    };

    const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('sucesso');

    expect(mockTransaction.update).toHaveBeenCalledTimes(4);
  });
});

/**
 * @name Remoção e Cancelamento de Amizade
 * @summary Gestão de rescisão de vínculos.
 * @description Cobre os fluxos de desfazer amizades aceitas, rejeitar pedidos recebidos e cancelar pedidos enviados.
 */
describe('DELETE /api/friendships/:friendshipId', () => {
  /**
   * @test Permissão de Exclusão
   * @summary Segurança de posse.
   * @description Garante erro 403 ao tentar excluir/cancelar amizade de terceiros.
   * 
   * @example
   * const res = await request(app).delete('/api/friendships/other-user_friend');
   * expect(res.status).toBe(403);
   */
  it('deve retornar 403 se o usuário não for dono', async () => {
    const res = await request(app).delete('/api/friendships/other-user_friend');
    expect(res.status).toBe(403);
  });

  /**
   * @test Amizade Inexistente (Exclusão)
   * @summary Erro de recurso ausente.
   * @description Garante erro 404 ao tentar apagar uma relação que não existe.
   * 
   * @example
   * const res = await request(app).delete('/api/friendships/non_existent_id');
   * expect(res.status).toBe(404);
   */
  it('deve retornar 404 se a relação não existir', async () => {
    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(404);
  });

  /**
   * @test Cancelar Pendente
   * @summary Revogação de pedido enviado.
   * @description Valida o fluxo de cancelamento de uma solicitação que o usuário logado enviou e ainda está pendente.
   * 
   * @example
   * const res = await request(app).delete('/api/friendships/sent_id');
   * expect(res.status).toBe(200);
   */
  it('deve cancelar solicitação pendente enviada', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('sucesso');
    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalled();
  });

  /**
   * @test Rejeitar Pendente
   * @summary Recusa de pedido recebido.
   * @description Valida o fluxo de rejeição de uma solicitação recebida de terceiros.
   * 
   * @example
   * const res = await request(app).delete('/api/friendships/requester_id');
   * expect(res.status).toBe(200);
   * expect(mockBatch.delete).toHaveBeenCalled();
   */
  it('deve rejeitar solicitação pendente recebida', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'friend-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalled();
  });

  /**
   * @test Desfazer Amizade
   * @summary Remoção de vínculo aceito.
   * @description Valida o fluxo de desfazer uma amizade que já foi aceita anteriormente.
   * 
   * @example
   * const res = await request(app).delete('/api/friendships/friend_id');
   * expect(res.status).toBe(200);
   */
  it('deve desfazer amizade aceita', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'accepted',
      requestedBy: 'friend-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalled();
  });
});

// =============================================================================
// TESTES DE LISTAGEM E PAGINAÇÃO
// =============================================================================

/**
 * @name Listagem de Amigos
 * @summary Visualização do grafo social.
 * @description Testes para a listagem paginada de amigos aceitos, com suporte a busca e ordenação.
 */
describe('GET /api/friendships', () => {
  /**
   * @name Helper Amigo Mock
   * @summary Gera amizade aceita completa.
   * @description Cria um objeto que simula uma relação de amizade com status 'accepted' 
   * e dados do amigo embutidos (denormalização), essencial para testes de listagem.
   * 
   * @params {string} id - ID do amigo
   * @params {string} name - Nome de exibição do amigo
   * @returns {Object} Documento de amizade denormalizado
   * 
   * @example
   * const friend = makeMockFriend('friend-user', 'Friend User');
   */
  const makeMockFriend = (id: string, name: string) => ({
    id: `current-user_${id}`,
    userId: 'current-user',
    friendId: id,
    status: 'accepted',
    requestedBy: id,
    createdAt: { toMillis: () => 1000, seconds: 1 },
    updatedAt: { toMillis: () => 1000, seconds: 1 },
    friendshipDate: { toMillis: () => 2000, seconds: 2 },
    friend: {
      displayName: name,
      nickname: name.toLowerCase(),
      photoURL: null,
      email: `${name.toLowerCase()}@test.com`,
      bio: '',
      location: '',
    },
  });

  /**
   * @test Lista Vazia
   * @summary Ausência de amigos.
   * @description Garante que a rota retorne uma lista vazia e metadados de paginação corretos quando não há amigos.
   * 
   * @example
   * const res = await request(app).get('/api/friendships');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toEqual([]);
   */
  it('deve retornar lista vazia quando não tem amigos', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [];

    // [ACT] Chamar endpoint de listagem {@link listFriendsQuerySchema}
    const res = await request(app).get('/api/friendships');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
    expect(res.body.data.pagination.hasMore).toBe(false);
  });

  /**
   * @test Paginação
   * @summary Controle de limite de resultados.
   * @description Verifica se o parâmetro 'limit' é respeitado pelo motor de query em memória.
   * 
   * @example
   * const res = await request(app).get('/api/friendships?page=1&limit=2');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(2);
   */
  it('deve retornar amigos com paginação', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeMockFriend('user-1', 'Alice'),
      makeMockFriend('user-2', 'Bob'),
      makeMockFriend('user-3', 'Carol'),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendsQuerySchema}
    const res = await request(app).get('/api/friendships?page=1&limit=2');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.totalPages).toBe(2);
    expect(res.body.data.pagination.hasMore).toBe(true);
  });

  /**
   * @test Filtragem por Busca
   * @summary Refinamento de resultados.
   * @description Testa a funcionalidade de busca por nome ou nickname do amigo.
   * 
   * @example
   * const res = await request(app).get('/api/friendships?search=silva');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(2);
   */
  it('deve filtrar amigos por busca', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeMockFriend('user-1', 'Alice Silva'),
      makeMockFriend('user-2', 'Bob Santos'),
      makeMockFriend('user-3', 'Carol Silva'),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendsQuerySchema}
    const res = await request(app).get('/api/friendships?search=silva');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(2);
  });

  /**
   * @test Ordenação
   * @summary Organização dos resultados.
   * @description Verifica se a ordenação por nome ascendente funciona corretamente.
   * 
   * @example
   * const res = await request(app).get('/api/friendships?sortBy=name&sortDirection=asc');
   * expect(res.status).toBe(200);
   * expect(res.body.data[0].friend.displayName).toBe('Alice');
   */
  it('deve ordenar amigos por nome ascendente', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeMockFriend('user-1', 'Carol'),
      makeMockFriend('user-2', 'Alice'),
      makeMockFriend('user-3', 'Bob'),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendsQuerySchema}
    const res = await request(app).get('/api/friendships?sortBy=name&sortDirection=asc');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data[0].friend.displayName).toBe('Alice');
    expect(res.body.data.data[1].friend.displayName).toBe('Bob');
    expect(res.body.data.data[2].friend.displayName).toBe('Carol');
  });

  /**
   * @test Parâmetros Inválidos
   * @summary Validação de entrada.
   * @description Garante que a rota retorne 400 Bad Request para parâmetros de query inválidos.
   * 
   * @example
   * const res = await request(app).get('/api/friendships?page=0');
   * expect(res.status).toBe(400);
   */
  it('deve retornar 400 para parâmetros inválidos', async () => {
    // [ACT] Chamar endpoint de listagem com parâmetro inválido {@link listFriendsQuerySchema}
    const res = await request(app).get('/api/friendships?page=0');

    // [ASSERT] Validações
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Paginação Extrema por Cursor
   * @summary Estabilidade em grandes volumes.
   * @description Simula 25 amigos e valida a navegação entre páginas usando o cursor base64 do Firestore.
   * 
   * @example
   * const res = await request(app).get('/api/friendships?limit=10&page=1');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(10);
   * expect(res.body.pagination.hasMore).toBe(true);
   */
  it('deve suportar paginação extrema usando cursores', async () => {
    // 1. Criar 25 amigos no estado simulado
    const manyFriends = Array.from({ length: 25 }, (_, i) =>
      makeMockFriend(`user-${i}`, `Amigo ${i.toString().padStart(2, '0')}`)
    );
    state.queryResults['friendships'] = manyFriends;

    // 2. Buscar primeira página (10 items)
    const res1 = await request(app).get('/api/friendships?limit=10&page=1');
    expect(res1.body.data.data).toHaveLength(10);
    expect(res1.body.data.pagination.hasMore).toBe(true);
    expect(res1.body.data.pagination.nextCursor).toBeDefined();

    const cursor = res1.body.data.pagination.nextCursor;

    // 3. Buscar segunda página usando o cursor
    const res2 = await request(app).get(`/api/friendships?limit=10&cursor=${cursor}`);
    expect(res2.body.data.data).toHaveLength(10);
    expect(res2.body.data.data[0].friendId).toBe('user-10'); // Verificação de sequência simplificada
    expect(res2.body.data.pagination.hasMore).toBe(true);
  });
});

/**
 * @name Pedidos de Amizade Recebidos
 * @summary Gestão de solicitações de terceiros.
 * @description Conjunto de testes para a listagem e filtragem de pedidos de amizade que o usuário recebeu.
 */
describe('GET /api/friendships/requests', () => {
  const makeRequest = (friendId: string, name: string, requestedBy: string, createdMillis: number) => ({
    id: `current-user_${friendId}`,
    userId: 'current-user',
    friendId,
    status: 'pending',
    requestedBy,
    createdAt: { toMillis: () => createdMillis, seconds: createdMillis / 1000 },
    updatedAt: { toMillis: () => createdMillis, seconds: createdMillis / 1000 },
    friend: { displayName: name, nickname: name.toLowerCase(), photoURL: null, email: '', bio: '', location: '' },
  });

  /**
   * @test Filtragem de Pedidos Recebidos
   * @summary Exibição correta de solicitações.
   * @description Garante que a rota retorne apenas pedidos de amizade recebidos (não enviados pelo próprio usuário).
   * 
   * @example
   * const res = await request(app).get('/api/friendships/requests');
   * expect(res.body.data).toHaveLength(2);
   * 
   * @note Regra de Negócio (Pedidos Recebidos):
   * - Filtra pedidos que o próprio usuário enviou (enviados != recebidos).
   */
  it('deve retornar apenas pedidos recebidos (não enviados)', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice', 'user-1', 3000),
      makeRequest('user-2', 'Bob', 'current-user', 2000),
      makeRequest('user-3', 'Carol', 'user-3', 1000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/requests');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.data[0].friend.displayName).toBe('Alice'); // mais recente primeiro
    expect(res.body.data.data[1].friend.displayName).toBe('Carol');
  });

  /**
   * @test Paginação de Pedidos Recebidos
   * @summary Controle de limite de resultados.
   * @description Verifica se o parâmetro 'limit' é respeitado para pedidos recebidos.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/requests?page=1&limit=2');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(2);
   */
  it('deve paginar pedidos recebidos', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice', 'user-1', 3000),
      makeRequest('user-2', 'Bob', 'user-2', 2000),
      makeRequest('user-3', 'Carol', 'user-3', 1000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/requests?page=1&limit=2');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.hasMore).toBe(true);
  });

  /**
   * @test Busca em Pedidos Recebidos
   * @summary Refinamento de resultados.
   * @description Testa a funcionalidade de busca por nome ou nickname do remetente do pedido.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/requests?search=alice');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(1);
   */
  it('deve filtrar pedidos por busca', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice Silva', 'user-1', 3000),
      makeRequest('user-2', 'Bob Santos', 'user-2', 2000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/requests?search=alice');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].friend.displayName).toBe('Alice Silva');
  });

  /**
   * @test Pedidos Recebidos Vazios
   * @summary Ausência de solicitações.
   * @description Garante que a rota retorne uma lista vazia e metadados de paginação corretos quando não há pedidos recebidos.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/requests');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toEqual([]);
   */
  it('deve retornar vazio quando não há pedidos', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [];

    // [ACT] Chamar endpoint de listagem {@link listFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/requests');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });
});

/**
 * @name Pedidos de Amizade Enviados
 * @summary Rastreamento de solicitações de saída.
 * @description Testes para a listagem de pedidos de amizade enviados pelo usuário autenticado que ainda estão pendentes.
 * 
 * @example
 * const res = await request(app).get('/api/friendships/sent');
 * expect(res.status).toBe(200);
 * expect(res.body.data).toEqual([]);
 */
describe('GET /api/friendships/sent', () => {
  const makeSent = (friendId: string, name: string, createdMillis: number) => ({
    id: `current-user_${friendId}`,
    userId: 'current-user',
    friendId,
    status: 'pending',
    requestedBy: 'current-user', // enviado pelo usuário atual
    createdAt: { toMillis: () => createdMillis, seconds: createdMillis / 1000 },
    updatedAt: { toMillis: () => createdMillis, seconds: createdMillis / 1000 },
    friend: { displayName: name, nickname: name.toLowerCase(), photoURL: null, email: '', bio: '', location: '' },
  });

  /**
   * @test Filtragem de Pedidos Enviados
   * @summary Exibição correta de solicitações.
   * @description Garante que a rota retorne apenas pedidos de amizade enviados pelo próprio usuário.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/sent');
   * expect(res.body.data).toHaveLength(2);
   * 
   * @note Regra de Negócio (Pedidos Enviados):
   * - Garante que pedidos recebidos de terceiros sejam filtrados da listagem 'sent'.
   */
  it('deve retornar apenas pedidos enviados', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice', 3000),
      {
        id: 'current-user_user-2', userId: 'current-user', friendId: 'user-2',
        status: 'pending', requestedBy: 'user-2',
        createdAt: { toMillis: () => 2000, seconds: 2 }, updatedAt: { toMillis: () => 2000, seconds: 2 },
        friend: { displayName: 'Bob', nickname: 'bob', photoURL: null, email: '', bio: '', location: '' },
      },
      makeSent('user-3', 'Carol', 1000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listSentFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/sent');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.data[0].friend.displayName).toBe('Alice');
    expect(res.body.data.data[1].friend.displayName).toBe('Carol');
  });

  /**
   * @test Paginação de Pedidos Enviados
   * @summary Controle de limite de resultados.
   * @description Verifica se o parâmetro 'limit' é respeitado para pedidos enviados.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/sent?page=2&limit=2');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(1);
   */
  it('deve paginar pedidos enviados', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice', 3000),
      makeSent('user-2', 'Bob', 2000),
      makeSent('user-3', 'Carol', 1000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listSentFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/sent?page=2&limit=2');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.pagination.page).toBe(2);
    expect(res.body.data.pagination.hasMore).toBe(false);
  });

  /**
   * @test Busca em Pedidos Enviados
   * @summary Refinamento de resultados.
   * @description Testa a funcionalidade de busca por nome ou nickname do destinatário do pedido.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/sent?search=bob');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toHaveLength(1);
   */
  it('deve filtrar pedidos enviados por busca', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice Silva', 3000),
      makeSent('user-2', 'Bob Santos', 2000),
    ];

    // [ACT] Chamar endpoint de listagem {@link listSentFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/sent?search=bob');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].friend.displayName).toBe('Bob Santos');
  });

  /**
   * @test Pedidos Enviados Vazios
   * @summary Ausência de solicitações.
   * @description Garante que a rota retorne uma lista vazia e metadados de paginação corretos quando não há pedidos enviados.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/sent');
   * expect(res.status).toBe(200);
   * expect(res.body.data).toEqual([]);
   */
  it('deve retornar vazio quando não há pedidos enviados', async () => {
    // [ARRANGE] Popular banco simulado
    state.queryResults['friendships'] = [];

    // [ACT] Chamar endpoint de listagem {@link listSentFriendRequestsQuerySchema}
    const res = await request(app).get('/api/friendships/sent');

    // [ASSERT] Validações
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });
});

// =============================================================================
// TESTES DE AÇÕES EM LOTE (BULK ACTIONS)
// =============================================================================

/**
 * @name Aceite em Lote
 * @summary Processamento massivo de aprovações.
 * @description Testes para a funcionalidade de aceitar múltiplos pedidos de amizade em uma única transação atômica.
 */
describe('POST /api/friendships/bulk-accept', () => {
  /**
   * @test FriendIds Ausente
   * @summary Erro de validação.
   * @description Verifica se a API retorna 400 quando o body não contém o campo 'friendIds'.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-accept').send({});
   * expect(res.status).toBe(400);
   * expect(res.body).toHaveProperty('error');
   */
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-accept').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test FriendIds Vazio
   * @summary Erro de validação.
   * @description Verifica se a API retorna 400 quando 'friendIds' é uma lista vazia.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: [] });
   * expect(res.status).toBe(400);
   * expect(res.body).toHaveProperty('error');
   */
  it('deve retornar 400 se friendIds estiver vazio', async () => {
    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Aceite em Lote Sucesso
   * @summary Aprovação em massa.
   * @description Garante que múltiplas solicitações pendentes sejam aceitas e os contadores atualizados em uma transação.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['id1'] });
   * expect(res.body.accepted).toContain('id1');
   * 
   * @note Lógica de contadores:
   * - 2 atualizações de amizade por amigo (bidirecional).
   * - 2 atualizações de contador dos amigos (amigo.friendsCount++).
   * - 1 atualização de contador do usuário logado (usuario.friendsCount++).
   * Total: (2 * N) + N + 1 = 7 para N=2.
   */
  it('deve aceitar múltiplas solicitações com sucesso', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'user-2' };
    state.docStore['friendships/user-2_current-user'] = { status: 'pending', requestedBy: 'user-2' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toEqual(['user-1', 'user-2']);
    expect(res.body.data.skipped).toEqual([]);
    expect(mockTransaction.update).toHaveBeenCalledTimes(7);
  });

  /**
   * @test Processamento Parcial
   * @summary Tratamento de IDs inválidos ou inexistentes.
   * @description Garante que a API processe os IDs válidos e retorne os inválidos na lista de 'skipped'.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1', 'user-2', 'user-3'] });
   * expect(res.status).toBe(200);
   * expect(res.body.accepted).toEqual(['user-1']);
   * expect(res.body.skipped).toEqual(['user-2', 'user-3']);
   * 
   * @note Configuração de Estado:
   * - user-2: Simulado como inexistente (lista vazia em queryResults).
   * - user-3: Simulado como amizade já aceita (não pendente).
   */
  it('deve pular solicitações inválidas e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'user-1' };
    state.queryResults['friendships:0'] = [];
    state.docStore['friendships/current-user_user-3'] = { status: 'accepted', requestedBy: 'user-3' };
    state.docStore['friendships/user-3_current-user'] = { status: 'accepted', requestedBy: 'user-3' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1', 'user-2', 'user-3'] });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toEqual(['user-1']);
    expect(res.body.data.skipped).toHaveLength(2);
    expect(res.body.data.skipped[0].friendId).toBe('user-2');
    expect(res.body.data.skipped[1].friendId).toBe('user-3');
  });

  /**
   * @test Solicitação Própria
   * @summary Prevenção de auto-aceite.
   * @description Garante que o usuário não consiga aceitar pedidos que ele mesmo enviou via processamento em lote.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1'] });
   * expect(res.status).toBe(200);
   * expect(res.body.accepted).toEqual([]);
   * expect(res.body.skipped).toHaveLength(1);
   */
  it('deve pular solicitações enviadas pelo próprio usuário', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toEqual([]);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].reason).toContain('própria');
  });
});

/**
 * @name Rejeição em Lote
 * @summary Recusa massiva de solicitações.
 * @description Valida o processamento atômico de múltiplas rejeições de pedidos de amizade.
 */
describe('POST /api/friendships/bulk-reject', () => {
  /**
   * @test FriendIds Ausente (Rejeição)
   * @summary Erro de validação.
   * @description Verifica se a API retorna 400 na rejeição em lote quando o body é inválido.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-reject').send({});
   * expect(res.status).toBe(400);
   * expect(res.body).toHaveProperty('error');
   */
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-reject').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Rejeição em Lote Sucesso
   * @summary Recusa em massa.
   * @description Garante que múltiplas solicitações pendentes sejam removidas e os contadores atualizados corretamente.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
   * expect(res.status).toBe(200);
   * expect(res.body.accepted).toEqual(['user-1', 'user-2']);
   * expect(res.body.skipped).toEqual([]);
   * 
   * @note Lógica de persistência:
   * - Delete: 2 documentos por amizade (bidirecional).
   * - Contadores: 2 atualizações para os remetentes + 1 para o destinatário logado.
   */
  it('deve rejeitar múltiplas solicitações recebidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'user-2' };

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toEqual(['user-1', 'user-2']);
    expect(res.body.data.skipped).toEqual([]);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(4);
    expect(mockTransaction.update).toHaveBeenCalledTimes(3);
  });

  /**
   * @test Cancelamento Sugerido
   * @summary Validação de intenção.
   * @description Garante que o sistema sugira 'bulk-cancel' se o usuário tentar rejeitar um pedido que ele mesmo enviou.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1'] });
   * expect(res.status).toBe(200);
   * expect(res.body.rejected).toEqual([]);
   * expect(res.body.skipped).toHaveLength(1);
   * expect(res.body.skipped[0].reason).toContain('bulk-cancel');
   */
  it('deve pular solicitações enviadas pelo próprio usuário', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toEqual([]);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].reason).toContain('bulk-cancel');
  });

  /**
   * @test Inexistentes em Lote
   * @summary Resiliência no processamento.
   * @description Garante que IDs inexistentes não quebrem a operação em lote e sejam reportados como 'skipped'.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
   * expect(res.status).toBe(200);
   * expect(res.body.rejected).toEqual(['user-1']);
   * expect(res.body.skipped).toHaveLength(1);
   * 
   * @note Configuração de Estado:
   * - user-2: Não adicionado ao docStore (inexistente).
   */
  it('deve pular solicitações inexistentes e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toEqual(['user-1']);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].friendId).toBe('user-2');
  });
});

/**
 * @name Cancelamento em Lote
 * @summary Revogação massiva de pedidos enviados.
 * @description Testa a remoção em massa de solicitações de amizade que o usuário enviou.
 */
describe('POST /api/friendships/bulk-cancel', () => {
  /**
   * @test FriendIds Ausente (Cancelamento)
   * @summary Erro de validação.
   * @description Verifica se a API retorna 400 no cancelamento em lote quando o body é inválido.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-cancel').send({});
   * expect(res.status).toBe(400);
   * expect(res.body).toHaveProperty('error');
   */
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-cancel').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  /**
   * @test Cancelamento em Lote Sucesso
   * @summary Revogação em massa.
   * @description Garante que múltiplas solicitações enviadas pelo usuário sejam canceladas com sucesso.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
   * expect(res.status).toBe(200);
   * expect(res.body.cancelled).toEqual(['user-1', 'user-2']);
   * expect(res.body.skipped).toEqual([]);
   * 
   * @note Lógica de persistência:
   * - Delete: 2 documentos por amizade (bidirecional).
   * - Contadores: 1 atualização para o remetente logado + 2 para os destinatários.
   */
  it('deve cancelar múltiplas solicitações enviadas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toEqual(['user-1', 'user-2']);
    expect(res.body.data.skipped).toEqual([]);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(4);
    expect(mockTransaction.update).toHaveBeenCalledTimes(3);
  });

  /**
   * @test Pedidos Recebidos (Ignorar)
   * @summary Prevenção de cancelamento indevido.
   * @description Garante que o usuário não consiga cancelar solicitações que ele recebeu (deve usar bulk-reject).
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1'] });
   * expect(res.status).toBe(200);
   * expect(res.body.cancelled).toEqual([]);
   * expect(res.body.skipped).toHaveLength(1);
   * expect(res.body.skipped[0].reason).toContain('bulk-reject');
   */
  it('deve pular solicitações recebidas (não enviadas)', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toEqual([]);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].reason).toContain('bulk-reject');
  });

  /**
   * @test IDs Inexistentes (Cancelamento)
   * @summary Resiliência no processamento.
   * @description Garante que IDs sem relação de amizade pendente sejam reportados no 'skipped'.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
   * expect(res.status).toBe(200);
   * expect(res.body.cancelled).toEqual(['user-1']);
   * expect(res.body.skipped).toHaveLength(1);
   * 
   * @note Configuração de Estado:
   * - user-2: Não adicionado ao docStore (inexistente).
   */
  it('deve pular solicitações inexistentes e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelled).toEqual(['user-1']);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].friendId).toBe('user-2');
  });
});

// =============================================================================
// TESTES DE SINCRONIZAÇÃO E PERFIL
// =============================================================================

/**
 * @name Sincronização de Perfil de Amigos
 * @summary Propagação massiva de dados denormalizados.
 * @description Testes para o endpoint que sincroniza os dados do perfil do usuário em todos os seus documentos de amizade.
 */
describe('POST /api/friendships/sync-profile', () => {
  /**
   * @test Usuário Inexistente (Sync)
   * @summary Tratamento de inconsistência.
   * @description Verifica se a API retorna 404 se o usuário autenticado não possuir documento de perfil.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/sync-profile');
   * expect(res.status).toBe(404);
   * expect(res.body.error).toContain('não encontrado');
   * 
   * @note Configuração de Estado:
   * - current-user: Simulado como inexistente (ausente no docStore).
   */
  it('deve retornar 404 se the usuário não existir', async () => {
    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('não encontrado');
  });

  /**
   * @test Sem Amizades (Sync)
   * @summary Operação vazia.
   * @description Garante que a sincronização retorne sucesso (0 atualizações) se o usuário não possuir amigos.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/sync-profile');
   * expect(res.status).toBe(200);
   * expect(res.body.updated).toBe(0);
   */
  it('deve retornar 200 com 0 atualizações quando não há amizades', async () => {
    state.docStore['users/current-user'] = {
      displayName: 'Novo Nome',
      nickname: 'novonome',
      photoURL: 'https://photo.jpg',
      bio: 'Minha bio',
      location: 'São Paulo',
    };
    state.queryResults['friendships'] = [];

    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(0);
  });

  /**
   * @test Sincronização Atômica
   * @summary Atualização de múltiplos documentos.
   * @description Verifica se a mudança de dados do usuário logado é propagada corretamente para todos os seus amigos via batch.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/sync-profile');
   * expect(res.body.updated).toBe(3);
   */
  it('deve atualizar dados denormalizados em todas as amizades', async () => {
    state.docStore['users/current-user'] = {
      displayName: 'Nome Atualizado',
      nickname: 'atualizado',
      photoURL: 'https://nova-foto.jpg',
      bio: 'Nova bio',
      location: 'Rio de Janeiro',
    };
    state.queryResults['friendships'] = [
      { id: 'user-1_current-user', friendId: 'current-user' },
      { id: 'user-2_current-user', friendId: 'current-user' },
      { id: 'user-3_current-user', friendId: 'current-user' },
    ];

    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(3);
    expect(mockBatch.update).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  /**
   * @test Sincronização Massiva
   * @summary Divisão em múltiplos batches.
   * @description Valida a lógica de chunking (FIRESTORE_BATCH_LIMIT) quando o usuário possui mais de 500 amigos.
   * 
   * @example
   * const res = await request(app).post('/api/friendships/sync-profile');
   * expect(res.status).toBe(200);
   * expect(res.body.updated).toBe(502);
   * 
   * @note Lógica de Escrita:
   * - O Firestore limita transações em lote a 500 operações. O teste simula 502 amigos para garantir que dois batches sejam commitados.
   */
  it('deve dividir em múltiplos batches quando excede o limite', async () => {
    state.docStore['users/current-user'] = {
      displayName: 'Test',
      nickname: 'test',
      photoURL: null,
      bio: '',
      location: '',
    };

    const manyDocs = Array.from({ length: 502 }, (_, i) => ({
      id: `user-${i}_current-user`,
      friendId: 'current-user',
    }));
    state.queryResults['friendships'] = manyDocs;

    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(502);

    expect(mockDb.batch).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
  });
});

/**
 * @name Amigos Mútuos
 * @summary Identificação de conexões em comum.
 * @description Testes para o cálculo e listagem de amigos que o usuário logado e outro usuário possuem em comum.
 */
describe('GET /api/friendships/mutual/:userId', () => {
  /**
   * @test Mútuos Próprios
   * @summary Comparação consigo mesmo.
   * @description Garante que a API retorne 0 ao tentar calcular amigos mútuos com o próprio ID logado.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/mutual/current-user');
   * expect(res.status).toBe(200);
   * expect(res.body.count).toBe(0);
   * expect(res.body.friends).toEqual([]);
   */
  it('deve retornar vazio para o próprio usuário', async () => {
    const res = await request(app).get('/api/friendships/mutual/current-user');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.friends).toEqual([]);
  });

  /**
   * @test Intersecção de Amizades
   * @summary Identificação de amigos mútuos.
   * @description Executa a lógica de intersecção entre a lista de amigos do usuário logado e a do alvo.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/mutual/target-user');
   * expect(res.body.friends[0].id).toBe('user-3');
   */
  it('deve retornar amigos em comum', async () => {
    state.queryResults['friendships:0'] = [
      { id: 'f1', friendId: 'user-3', status: 'accepted', friend: { displayName: 'User 3', nickname: 'u3', photoURL: null } },
      { id: 'f2', friendId: 'user-4', status: 'accepted', friend: { displayName: 'User 4', nickname: 'u4', photoURL: null } },
    ];
    state.queryResults['friendships:1'] = [
      { id: 'f3', friendId: 'user-3', status: 'accepted', friend: { displayName: 'User 3', nickname: 'u3', photoURL: null } },
      { id: 'f4', friendId: 'user-5', status: 'accepted', friend: { displayName: 'User 5', nickname: 'u5', photoURL: null } },
    ];

    const res = await request(app).get('/api/friendships/mutual/target-user');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.friends[0].id).toBe('user-3');
  });

  /**
   * @test Sem Amigos Mútuos
   * @summary Comparação sem intersecção.
   * @description Garante que a API retorne count 0 quando não há sobreposição entre as listas de amigos.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/mutual/target-user');
   * expect(res.body.count).toBe(0);
   * expect(res.body.friends).toEqual([]);
   */
  it('deve retornar vazio quando não há amigos em comum', async () => {
    state.queryResults['friendships:0'] = [
      { id: 'f1', friendId: 'user-3', status: 'accepted', friend: {} },
    ];
    state.queryResults['friendships:1'] = [
      { id: 'f2', friendId: 'user-5', status: 'accepted', friend: {} },
    ];

    const res = await request(app).get('/api/friendships/mutual/target-user');
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.friends).toEqual([]);
  });
});

/**
 * @name Status de Amizade
 * @summary Consulta de estado da relação.
 * @description Verifica o vínculo atual entre o usuário logado e um terceiro (none, self, friends, request_sent, request_received).
 */
describe('GET /api/friendships/status/:userId', () => {
  /**
   * @test Status Self
   * @summary Autoconsulta de relação.
   * @description Identifica que o usuário está consultando a si mesmo, retornando status 'self'.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/status/current-user');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('self');
   */
  it('deve retornar "self" para o próprio usuário', async () => {
    const res = await request(app).get('/api/friendships/status/current-user');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('self');
  });

  /**
   * @test Status None
   * @summary Ausência de relação.
   * @description Retorna 'none' quando não existe nenhum documento de amizade (ou pedido) entre os dois usuários.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/status/other-user');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('none');
   */
  it('deve retornar "none" se não houver amizade', async () => {
    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('none');
  });

  /**
   * @test Status Friends
   * @summary Amizade estabelecida.
   * @description Retorna 'friends' quando a relação possui status 'accepted'.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/status/other-user');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('friends');
   */
  it('deve retornar "friends" se amizade for aceita', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'accepted',
      requestedBy: 'other-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('friends');
  });

  /**
   * @test Status Request Sent
   * @summary Pedido enviado pelo autor.
   * @description Retorna 'request_sent' quando há um pedido pendente onde o autor foi quem solicitou.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/status/other-user');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('request_sent');
   */
  it('deve retornar "request_sent" se o usuário enviou a solicitação', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('request_sent');
  });

  /**
   * @test Estado de Recebimento
   * @summary Identificação de pedido pendente.
   * @description Garante que o status 'request_received' seja retornado quando há uma solicitação enviada pelo alvo.
   * 
   * @example
   * const res = await request(app).get('/api/friendships/status/other-user');
   * expect(res.status).toBe(200);
   * expect(res.body.status).toBe('request_received');
   */
  it('deve retornar "request_received" se outro enviou a solicitação', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'pending',
      requestedBy: 'other-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('request_received');
  });
});

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
vi.mock("../middleware/auth.middleware", () => ({
    checkAuth: vi.fn((req, res, next) => { req.user = { uid: "current-user" }; if (next) next(); }),
    checkAuthOptional: vi.fn((req, res, next) => { req.user = { uid: "current-user" }; if (next) next(); })
}));

// ==== ==== SETUP E CICLO DE VIDA ==== ====

/**
 * @name Ciclo de Vida: Reset
 * @summary Limpeza entre casos de teste.
 * @description Reinicia o banco de dados simulado e limpa o cache local '*' antes de cada execução.
 */
beforeEach(async () => {
  state.docStore = {};
  state.queryResults = {};
  state.queryCallCount = {};
  vi.clearAllMocks();
  await invalidatePattern('*');
});

// ==== ==== CASOS DE TESTE (USERS) ==== ====

/**
 * @name Recuperação por Nickname
 * @summary Busca de perfil público.
 * @description Conjunto de testes para garantir que usuários possam ser encontrados via nickname único.
 */
describe('GET /api/users/by-nickname/:nickname', () => {
  /**
   * @test Perfil por Nickname
   * @summary Recuperação pública de perfil.
   * @description Verifica se a busca por nickname exato retorna os dados do usuário corretamente no banco simulado.
   * 
   * @example
   * const res = await request(app).get('/api/users/by-nickname/alice');
   * expect(res.body.nickname).toBe('alice');
   */
  it('deve retornar perfil por nickname', async () => {
    // [ARRANGE] Mockar usuário no banco simulado
    state.queryResults['users'] = [{ id: 'u1', nickname: 'alice', displayName: 'Alice' }];

    // [ACT] Chamar endpoint de busca por nickname {@link userIdParamSchema}
    const res = await request(app).get('/api/users/by-nickname/alice');

    // [ASSERT] Validar se os dados retornados condizem com o mock
    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('alice');
  });

  /**
   * @test Nickname Não Encontrado
   * @summary Erro 404 para apelido inexistente.
   * @description Verifica se a API retorna o status correto quando busca um nickname que não consta na base.
   * 
   * @example
   * const res = await request(app).get('/api/users/by-nickname/nonexistent');
   * expect(res.status).toBe(404);
   */
  it('deve retornar 404 se não encontrar', async () => {
    state.queryResults['users'] = [];
    const res = await request(app).get('/api/users/by-nickname/invalid');
    expect(res.status).toBe(404);
  });
});

/**
 * @name Verificação de Disponibilidade
 * @summary Unicidade de nicknames.
 * @description Garante que o sistema valide corretamente se um apelido está livre ou em uso.
 */
describe('GET /api/users/check-nickname', () => {
  /**
   * @test Apelido Disponível
   * @summary Verificação de unicidade.
   * @description Garante que o sistema informe positivamente quando um nickname não está em uso.
   * 
   * @example
   * const res = await request(app).get('/api/users/check-nickname?nickname=newuser');
   */
  it('deve retornar available true se disponível', async () => {
    state.queryResults['users'] = [];
    const res = await request(app).get('/api/users/check-nickname?nickname=newuser');
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
  });

  /**
   * @test Apelido Ocupado
   * @summary Prevenção de duplicidade.
   * @description Garante que o sistema informe quando um nickname já pertence a outro usuário.
   * 
   * @example
   * const res = await request(app).get('/api/users/check-nickname?nickname=taken');
   */
  it('deve retornar available false se ocupado', async () => {
    state.queryResults['users'] = [{ id: 'u1', nickname: 'taken' }];
    const res = await request(app).get('/api/users/check-nickname?nickname=taken');
    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });
});

/**
 * @name Busca de Usuários
 * @summary Pesquisa textual e filtros.
 * @description Conjunto de testes para o motor de busca de usuários por prefixo de nome ou nickname.
 */
describe('GET /api/users/search', () => {
  /**
   * @test Busca por Prefixo
   * @summary Filtragem em memória.
   * @description Valida se o motor de busca simulado filtra corretamente usuários baseado em um termo parcial ('q').
   * 
   * @example
   * const res = await request(app).get('/api/users/search?q=ali');
   * expect(res.body[0].nickname).toBe('alice');
   */
  it('deve buscar usuários por prefixo', async () => {
    state.queryResults['users'] = [
      { id: 'u1', nickname: 'alice', displayName: 'Alice Silva' },
      { id: 'u2', nickname: 'bob', displayName: 'Robert Bob' },
    ];

    const res = await request(app).get('/api/users/search?q=ali');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nickname).toBe('alice');
  });
});

/**
 * @name Estatísticas Pessoais
 * @summary Resumo de métricas do usuário.
 * @description Valida a recuperação de contadores (amigos, pedidos) para o dashboard do usuário logado.
 */
describe('GET /api/users/me/stats', () => {
  /**
   * @test Estatísticas do Perfil
   * @summary Recuperação de contadores.
   * @description Garante que os dados de contagem de amizade e solicitações sejam retornados corretamente.
   * 
   * @example
   * const res = await request(app).get('/api/users/me/stats');
   * expect(res.body.totalFriends).toBe(5);
   */
  it('deve retornar estatísticas do usuário logado', async () => {
    state.docStore['users/current-user'] = {
      friendsCount: 5,
      pendingRequestsCount: 2,
      sentRequestsCount: 1
    };

    const res = await request(app).get('/api/users/me/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totalFriends).toBe(5);
  });
});

/**
 * @name Perfil por ID e Bloqueios
 * @summary Recuperação por UID.
 * @description Testa a recuperação direta de perfis e a aplicação de regras sociais (bloqueios).
 */
describe('GET /api/users/:userId', () => {
  /**
   * @test Perfil por UID
   * @summary Busca direta.
   * @description Verifica se os dados básicos de um perfil são retornados corretamente ao consultar por ID único.
   * 
   * @example
   * const res = await request(app).get('/api/users/u1');
   * expect(res.body.displayName).toBe('Alice');
   */
  it('deve retornar perfil por ID', async () => {
    state.docStore['users/u1'] = { displayName: 'Alice' };

    const res = await request(app).get('/api/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alice');
  });

  /**
   * @test Acesso Bloqueado
   * @summary Verificação de restrições sociais.
   * @description Garante que a API retorne 403 Forbidden se houver um registro de bloqueio entre os usuários no Firestore.
   * 
   * @example
   * const res = await request(app).get('/api/users/u1');
   * 
   * @note Lógica de Bloqueio:
   * - O teste simula uma entrada na coleção 'blocks' indicando que o alvo bloqueou o solicitante.
   */
  it('deve bloquear acesso se houver bloqueio', async () => {
    state.docStore['blocks/u1_current-user'] = { createdAt: new Date() };
    state.docStore['users/u1'] = { displayName: 'Alice' };

    const res = await request(app).get('/api/users/u1');
    expect(res.status).toBe(403);
  });
});

/**
 * @name Endpoints de Avatar
 * @summary Gestão de fotos de perfil.
 * @description Conjunto de testes para listagem, curtidas e atualização da foto ativa do usuário.
 */
describe('Avatar Endpoints', () => {
  /**
   * @test Listagem de Avatares
   * @summary Galeria do usuário.
   * @description Verifica se todos os registros de avatares vinculados a um UID são retornados.
   * 
   * @example
   * const res = await request(app).get('/api/users/u1/avatars');
   * expect(res.body).toHaveLength(1);
   */
  it('deve listar avatares de um usuário', async () => {
    state.queryResults['userAvatars'] = [
      { id: 'a1', userId: 'u1', croppedUrl: 'url1' },
    ];

    const res = await request(app).get('/api/users/u1/avatars');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  /**
   * @test Curtir Avatar
   * @summary Interação social com fotos.
   * @description Valida a lógica de 'like' em um recurso de avatar simulado.
   * 
   * @example
   * const res = await request(app).post('/api/avatars/a1/like');
   */
  it('deve curtir um avatar', async () => {
    state.docStore['userAvatars/a1'] = { likes: [] };

    const res = await request(app).post('/api/avatars/a1/like');
    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(true);
  });

  /**
   * @test Atualização Completa de Perfil
   * @summary Valida persistência e sincronismo com Auth.
   * @description Verifica se o PATCH /api/users/me atualiza o Firestore, 
   * reserva o nickname e sincroniza os dados com o Firebase Auth.
   * 
   * @example
   * const res = await request(app)
   *   .patch('/api/users/me')
   *   .send(updates);
   */
  it('deve atualizar perfil completo e sincronizar com Firebase Auth', async () => {
    state.docStore['users/current-user'] = {
      nickname: 'antigo',
      displayName: 'Antigo Nome'
    };

    const updates = {
      nickname: 'novo_nick',
      displayName: 'Novo Nome',
      photoURL: 'https://new-photo.jpg',
      bio: 'Minha nova bio'
    };

    const res = await request(app)
      .patch('/api/users/me')
      .send(updates);

    expect(res.status).toBe(200);

    // Verificar Firestore
    const updatedDoc = state.docStore['users/current-user'];
    expect(updatedDoc.nickname).toBe('novo_nick');
    expect(updatedDoc.displayName).toBe('Novo Nome');
    expect(updatedDoc.photoURL).toBe('https://new-photo.jpg');
    expect(updatedDoc.bio).toBe('Minha nova bio');

    // Verificar Reserva de Nickname
    expect(state.docStore['nicknames/novo_nick']).toEqual({ userId: 'current-user' });
    expect(state.docStore['nicknames/antigo']).toBeUndefined();

    // Verificar Sincronismo com Firebase Auth (Admin SDK)
    // Nota: O backend faz duas chamadas separadas para displayName e photoURL
    expect(admin.auth().updateUser).toHaveBeenCalledWith('current-user', expect.objectContaining({
      displayName: 'Novo Nome'
    }));
    expect(admin.auth().updateUser).toHaveBeenCalledWith('current-user', expect.objectContaining({
      photoURL: 'https://new-photo.jpg'
    }));
  });

  /**
   * @test Atualização de Foto Ativa
   * @summary Mudança de avatar principal.
   * @description Garante que o documento do usuário logado seja atualizado com a nova URL de foto.
   * 
   * @example
   * const res = await request(app).patch('/api/users/me/photo').send({ photoURL: 'new' });
   * expect(state.docStore['users/current-user'].photoURL).toBe('new');
   */
  it('deve atualizar foto de perfil ativa', async () => {
    state.docStore['users/current-user'] = { photoURL: 'old' };

    const res = await request(app).patch('/api/users/me/photo').send({ photoURL: 'new' });
    expect(res.status).toBe(200);
    expect(state.docStore['users/current-user'].photoURL).toBe('new');
  });
});

/**
 * @name Testes de Concorrência
 * @summary Validação de atomicidade em operações competitivas.
 * @description Testa a robustez do sistema frente a condições de corrida, 
 * focando especialmente na geração de nicknames únicos durante o registro.
 */
describe('User Concurrency', () => {
  beforeEach(() => {
    // Resetar o estado para cada teste de concorrência
    state.docStore = {};
    vi.clearAllMocks();
  });

  /**
   * @test Registro Concorrente (Race Condition)
   * @summary Unicidade de nicknames sob carga.
   * @description Simula múltiplas solicitações de registro simultâneas para o mesmo nome de exibição.
   * Verifica se o sistema utiliza corretamente as transações do Firestore para evitar duplicatas 
   * e gerar sufixos incrementais (joaosilva, joaosilva-1, etc).
   */
  it('deve lidar com múltiplas solicitações de registro concorrentes para o mesmo nome', async () => {
    // [ARRANGE] Mocks de Auth para IDs diferentes sequencialmente
    let userCounter = 0;
    vi.mocked(admin.auth().createUser).mockImplementation(() =>
      Promise.resolve({ uid: `concurrent-user-${userCounter++}` } as any)
    );
    vi.mocked(admin.auth().createCustomToken).mockImplementation((uid) =>
      Promise.resolve(`token-${uid}`)
    );

    // [ACT] Disparar 3 registros simultâneos com o mesmo displayName
    // Isso deve desencadear a lógica de geração de sufixo incrementado
    const p1 = request(app).post('/api/register').send({
      email: 'user1@test.com', password: 'password123', displayName: 'João Silva'
    });
    const p2 = request(app).post('/api/register').send({
      email: 'user2@test.com', password: 'password123', displayName: 'João Silva'
    });
    const p3 = request(app).post('/api/register').send({
      email: 'user3@test.com', password: 'password123', displayName: 'João Silva'
    });

    const results = await Promise.all([p1, p2, p3]);

    // [ASSERT] Todos devem ter sucesso (201 Created)
    results.forEach(res => {
      if (res.status !== 201) console.error('Erro no registro concorrente:', res.body);
      expect(res.status).toBe(201);
    });

    // [ASSERT] Verificar se os nicknames gerados são únicos e seguem o padrão
    const documentedNicknames = Object.keys(state.docStore)
      .filter(path => path.startsWith('nicknames/'))
      .map(path => path.replace('nicknames/', ''));

    expect(documentedNicknames).toHaveLength(3);
    expect(documentedNicknames).toContain('joaosilva');
    expect(documentedNicknames).toContain('joaosilva-1');
    expect(documentedNicknames).toContain('joaosilva-2');

    // [ASSERT] Verificar se os perfis foram criados com os nicknames correspondentes
    const profiles = Object.values(state.docStore).filter(doc => doc.nickname && doc.email);
    const nicknamesInProfiles = profiles.map(p => p.nickname);

    expect(nicknamesInProfiles).toHaveLength(3);
    expect(nicknamesInProfiles).toContain('joaosilva');
    expect(nicknamesInProfiles).toContain('joaosilva-1');
    expect(nicknamesInProfiles).toContain('joaosilva-2');
  });
});

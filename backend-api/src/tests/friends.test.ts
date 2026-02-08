import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ==================== HOISTED MOCKS ====================

const { state, mockDb, mockBatch, mockTransaction, makeCollectionRef, makeDocSnapshot } = vi.hoisted(() => {
  const state = {
    docStore: {} as Record<string, any>,
    queryResults: {} as Record<string, any[]>,
    queryCallCount: {} as Record<string, number>,
  };

  const makeDocSnapshot = (id: string, data: any) => ({
    exists: data !== undefined,
    data: () => data,
    id,
  });

  const makeQuerySnapshot = (docs: Array<Record<string, any>>) => ({
    docs: docs.map(d => ({ id: d.id, data: () => d, exists: true, ref: { __path: `friendships/${d.id}`, __id: d.id } })),
    empty: docs.length === 0,
  });

  const makeDocRef = (collection: string, id: string) => ({
    __path: `${collection}/${id}`,
    __id: id,
    get: vi.fn(() => {
      const data = state.docStore[`${collection}/${id}`];
      return Promise.resolve(makeDocSnapshot(id, data));
    }),
  });

  const makeQueryChain = (collectionName: string) => {
    const chain: any = {};
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.get = vi.fn(() => {
      if (!state.queryCallCount[collectionName]) state.queryCallCount[collectionName] = 0;
      const idx = state.queryCallCount[collectionName]++;
      const results = state.queryResults[`${collectionName}:${idx}`] || state.queryResults[collectionName] || [];
      return Promise.resolve(makeQuerySnapshot(results));
    });
    return chain;
  };

  const makeCollectionRef = (name: string) => {
    const chain = makeQueryChain(name);
    return {
      doc: vi.fn((id: string) => makeDocRef(name, id)),
      where: chain.where,
      limit: chain.limit,
      get: chain.get,
      add: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    };
  };

  const mockTransaction = {
    get: vi.fn((ref: any) => {
      const data = state.docStore[ref.__path];
      return Promise.resolve(makeDocSnapshot(ref.__id, data));
    }),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb: any = {
    collection: vi.fn((name: string) => makeCollectionRef(name)),
    runTransaction: vi.fn(async (cb: Function) => cb(mockTransaction)),
    batch: vi.fn(() => mockBatch),
  };

  return { state, mockDb, mockBatch, mockTransaction, makeCollectionRef, makeDocSnapshot };
});

// ==================== MODULE MOCKS ====================

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestoreFn: any = () => mockDb;
  firestoreFn.Timestamp = {
    now: () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date() }),
  };
  firestoreFn.FieldValue = {
    increment: (n: number) => ({ __increment: n }),
  };

  return {
    default: { apps: [{}], initializeApp: vi.fn(), firestore: firestoreFn, auth: () => ({ verifySessionCookie: vi.fn() }) },
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    auth: () => ({ verifySessionCookie: vi.fn() }),
  };
});

vi.mock('../middleware/auth.middleware', () => ({
  checkAuth: vi.fn((req: any, _res: any, next: any) => {
    req.user = { uid: 'current-user' };
    next();
  }),
}));

import { app } from '../index';

// ==================== SETUP ====================

beforeEach(() => {
  state.docStore = {};
  state.queryResults = {};
  state.queryCallCount = {};
  vi.clearAllMocks();

  mockDb.collection.mockImplementation((name: string) => makeCollectionRef(name));
  mockDb.runTransaction.mockImplementation(async (cb: Function) => cb(mockTransaction));
  mockDb.batch.mockImplementation(() => mockBatch);
  mockBatch.commit.mockResolvedValue(undefined);
  mockTransaction.get.mockImplementation((ref: any) => {
    const data = state.docStore[ref.__path];
    return Promise.resolve(makeDocSnapshot(ref.__id, data));
  });
});

// ==================== TESTS ====================

describe('GET /api/findFriends', () => {
  it('deve retornar 400 se searchTerm estiver ausente', async () => {
    const res = await request(app).get('/api/findFriends');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 se searchTerm for muito curto', async () => {
    const res = await request(app).get('/api/findFriends?searchTerm=a');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar usuários correspondentes', async () => {
    state.queryResults['users'] = [
      { id: 'user-2', displayName: 'João Silva', nickname: 'joao', email: 'joao@test.com' },
    ];

    const res = await request(app).get('/api/findFriends?searchTerm=João');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].displayName).toBe('João Silva');
  });

  it('não deve incluir o usuário logado nos resultados', async () => {
    state.queryResults['users'] = [
      { id: 'current-user', displayName: 'Eu Mesmo', nickname: 'eu' },
      { id: 'user-2', displayName: 'Amigo', nickname: 'amigo' },
    ];

    const res = await request(app).get('/api/findFriends?searchTerm=test');
    expect(res.status).toBe(200);
    const ids = res.body.map((u: any) => u.id);
    expect(ids).not.toContain('current-user');
    expect(ids).toContain('user-2');
  });

  it('deve mesclar resultados sem duplicatas', async () => {
    state.queryResults['users:0'] = [
      { id: 'user-2', displayName: 'João', nickname: 'joao' },
    ];
    state.queryResults['users:1'] = [
      { id: 'user-2', displayName: 'João', nickname: 'joao' },
      { id: 'user-3', displayName: 'José', nickname: 'jose' },
    ];

    const res = await request(app).get('/api/findFriends?searchTerm=Jo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /api/friendships/request', () => {
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

  it('deve retornar 400 se targetUserId estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/request').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 ao enviar solicitação para si mesmo', async () => {
    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'current-user' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('si mesmo');
  });

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

  it('deve criar solicitação de amizade com sucesso', async () => {
    state.docStore['users/current-user'] = mockUserData('CurrentUser');
    state.docStore['users/target-user'] = mockUserData('TargetUser');

    const res = await request(app).post('/api/friendships/request').send({ targetUserId: 'target-user' });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('sucesso');
    expect(mockTransaction.set).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/friendships/:friendshipId/accept', () => {
  it('deve retornar 403 se o usuário não for dono da amizade', async () => {
    const res = await request(app).post('/api/friendships/other-user_friend/accept');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('permissão');
  });

  it('deve retornar 400 se a solicitação não existir', async () => {
    const res = await request(app).post('/api/friendships/current-user_friend-user/accept');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não encontrada');
  });

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
    expect(res.body.message).toContain('sucesso');
    // 2 friendship updates + 2 counter updates
    expect(mockTransaction.update).toHaveBeenCalledTimes(4);
  });
});

describe('DELETE /api/friendships/:friendshipId', () => {
  it('deve retornar 403 se o usuário não for dono', async () => {
    const res = await request(app).delete('/api/friendships/other-user_friend');
    expect(res.status).toBe(403);
  });

  it('deve retornar 404 se a relação não existir', async () => {
    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(404);
  });

  it('deve cancelar solicitação pendente enviada', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  });

  it('deve rejeitar solicitação pendente recebida', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'pending',
      requestedBy: 'friend-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  });

  it('deve desfazer amizade aceita', async () => {
    state.docStore['friendships/current-user_friend-user'] = {
      status: 'accepted',
      requestedBy: 'friend-user',
    };

    const res = await request(app).delete('/api/friendships/current-user_friend-user');
    expect(res.status).toBe(200);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(2);
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);
  });
});

// ==================== LISTAGEM ====================

describe('GET /api/friendships', () => {
  const makeFriend = (friendId: string, name: string, nickname: string, status = 'accepted') => ({
    id: `current-user_${friendId}`,
    userId: 'current-user',
    friendId,
    status,
    requestedBy: friendId,
    createdAt: { toMillis: () => 1000, seconds: 1 },
    updatedAt: { toMillis: () => 1000, seconds: 1 },
    friendshipDate: { toMillis: () => 2000, seconds: 2 },
    friend: { displayName: name, nickname, photoURL: null, email: `${nickname}@test.com`, bio: '', location: '' },
  });

  it('deve retornar lista vazia quando não tem amigos', async () => {
    state.queryResults['friendships'] = [];
    const res = await request(app).get('/api/friendships');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it('deve retornar amigos com paginação', async () => {
    state.queryResults['friendships'] = [
      makeFriend('user-1', 'Alice', 'alice'),
      makeFriend('user-2', 'Bob', 'bob'),
      makeFriend('user-3', 'Carol', 'carol'),
    ];

    const res = await request(app).get('/api/friendships?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it('deve filtrar amigos por busca', async () => {
    state.queryResults['friendships'] = [
      makeFriend('user-1', 'Alice Silva', 'alice'),
      makeFriend('user-2', 'Bob Santos', 'bob'),
      makeFriend('user-3', 'Carol Silva', 'carol'),
    ];

    const res = await request(app).get('/api/friendships?search=silva');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('deve ordenar amigos por nome ascendente', async () => {
    state.queryResults['friendships'] = [
      makeFriend('user-1', 'Carol', 'carol'),
      makeFriend('user-2', 'Alice', 'alice'),
      makeFriend('user-3', 'Bob', 'bob'),
    ];

    const res = await request(app).get('/api/friendships?sortBy=name&sortDirection=asc');
    expect(res.status).toBe(200);
    expect(res.body.data[0].friend.displayName).toBe('Alice');
    expect(res.body.data[1].friend.displayName).toBe('Bob');
    expect(res.body.data[2].friend.displayName).toBe('Carol');
  });

  it('deve retornar 400 para parâmetros inválidos', async () => {
    const res = await request(app).get('/api/friendships?page=0');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

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

  it('deve retornar apenas pedidos recebidos (não enviados)', async () => {
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice', 'user-1', 3000),     // recebido (requestedBy !== current-user)
      makeRequest('user-2', 'Bob', 'current-user', 2000),  // enviado (deve ser filtrado)
      makeRequest('user-3', 'Carol', 'user-3', 1000),      // recebido
    ];

    const res = await request(app).get('/api/friendships/requests');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].friend.displayName).toBe('Alice'); // mais recente primeiro
    expect(res.body.data[1].friend.displayName).toBe('Carol');
  });

  it('deve paginar pedidos recebidos', async () => {
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice', 'user-1', 3000),
      makeRequest('user-2', 'Bob', 'user-2', 2000),
      makeRequest('user-3', 'Carol', 'user-3', 1000),
    ];

    const res = await request(app).get('/api/friendships/requests?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.hasMore).toBe(true);
  });

  it('deve filtrar pedidos por busca', async () => {
    state.queryResults['friendships'] = [
      makeRequest('user-1', 'Alice Silva', 'user-1', 3000),
      makeRequest('user-2', 'Bob Santos', 'user-2', 2000),
    ];

    const res = await request(app).get('/api/friendships/requests?search=alice');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].friend.displayName).toBe('Alice Silva');
  });

  it('deve retornar vazio quando não há pedidos', async () => {
    state.queryResults['friendships'] = [];
    const res = await request(app).get('/api/friendships/requests');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

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

  it('deve retornar apenas pedidos enviados', async () => {
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice', 3000),
      // Este é um pedido recebido, deve ser filtrado
      {
        id: 'current-user_user-2', userId: 'current-user', friendId: 'user-2',
        status: 'pending', requestedBy: 'user-2',
        createdAt: { toMillis: () => 2000, seconds: 2 }, updatedAt: { toMillis: () => 2000, seconds: 2 },
        friend: { displayName: 'Bob', nickname: 'bob', photoURL: null, email: '', bio: '', location: '' },
      },
      makeSent('user-3', 'Carol', 1000),
    ];

    const res = await request(app).get('/api/friendships/sent');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].friend.displayName).toBe('Alice');
    expect(res.body.data[1].friend.displayName).toBe('Carol');
  });

  it('deve paginar pedidos enviados', async () => {
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice', 3000),
      makeSent('user-2', 'Bob', 2000),
      makeSent('user-3', 'Carol', 1000),
    ];

    const res = await request(app).get('/api/friendships/sent?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it('deve filtrar pedidos enviados por busca', async () => {
    state.queryResults['friendships'] = [
      makeSent('user-1', 'Alice Silva', 3000),
      makeSent('user-2', 'Bob Santos', 2000),
    ];

    const res = await request(app).get('/api/friendships/sent?search=bob');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].friend.displayName).toBe('Bob Santos');
  });

  it('deve retornar vazio quando não há pedidos enviados', async () => {
    state.queryResults['friendships'] = [];
    const res = await request(app).get('/api/friendships/sent');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

// ==================== AÇÕES EM LOTE ====================

describe('POST /api/friendships/bulk-accept', () => {
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-accept').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve retornar 400 se friendIds estiver vazio', async () => {
    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve aceitar múltiplas solicitações com sucesso', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'user-2' };
    state.docStore['friendships/user-2_current-user'] = { status: 'pending', requestedBy: 'user-2' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual(['user-1', 'user-2']);
    expect(res.body.skipped).toEqual([]);
    // 2 friendship updates per friend (2x2=4) + 2 friend counter updates + 1 user counter = 7
    expect(mockTransaction.update).toHaveBeenCalledTimes(7);
  });

  it('deve pular solicitações inválidas e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'user-1' };
    // user-2 não existe
    state.docStore['friendships/current-user_user-3'] = { status: 'accepted', requestedBy: 'user-3' };
    state.docStore['friendships/user-3_current-user'] = { status: 'accepted', requestedBy: 'user-3' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1', 'user-2', 'user-3'] });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual(['user-1']);
    expect(res.body.skipped).toHaveLength(2);
    expect(res.body.skipped[0].friendId).toBe('user-2');
    expect(res.body.skipped[1].friendId).toBe('user-3');
  });

  it('deve pular solicitações enviadas pelo próprio usuário', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };
    state.docStore['friendships/user-1_current-user'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-accept').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual([]);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('própria');
  });
});

describe('POST /api/friendships/bulk-reject', () => {
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-reject').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve rejeitar múltiplas solicitações recebidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'user-2' };

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toEqual(['user-1', 'user-2']);
    expect(res.body.skipped).toEqual([]);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(4); // 2 docs per friendship
    // 2 friend counter updates + 1 user counter = 3
    expect(mockTransaction.update).toHaveBeenCalledTimes(3);
  });

  it('deve pular solicitações enviadas pelo próprio usuário', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toEqual([]);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('bulk-cancel');
  });

  it('deve pular solicitações inexistentes e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };
    // user-2 não existe

    const res = await request(app).post('/api/friendships/bulk-reject').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toEqual(['user-1']);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].friendId).toBe('user-2');
  });
});

describe('POST /api/friendships/bulk-cancel', () => {
  it('deve retornar 400 se friendIds estiver ausente', async () => {
    const res = await request(app).post('/api/friendships/bulk-cancel').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve cancelar múltiplas solicitações enviadas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };
    state.docStore['friendships/current-user_user-2'] = { status: 'pending', requestedBy: 'current-user' };

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toEqual(['user-1', 'user-2']);
    expect(res.body.skipped).toEqual([]);
    expect(mockTransaction.delete).toHaveBeenCalledTimes(4);
    expect(mockTransaction.update).toHaveBeenCalledTimes(3);
  });

  it('deve pular solicitações recebidas (não enviadas)', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'user-1' };

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1'] });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toEqual([]);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('bulk-reject');
  });

  it('deve pular solicitações inexistentes e processar válidas', async () => {
    state.docStore['friendships/current-user_user-1'] = { status: 'pending', requestedBy: 'current-user' };
    // user-2 não existe

    const res = await request(app).post('/api/friendships/bulk-cancel').send({ friendIds: ['user-1', 'user-2'] });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toEqual(['user-1']);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].friendId).toBe('user-2');
  });
});

// ==================== SINCRONIZAÇÃO ====================

describe('POST /api/friendships/sync-profile', () => {
  it('deve retornar 404 se o usuário não existir', async () => {
    // current-user não existe no docStore
    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('não encontrado');
  });

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
    expect(res.body.updated).toBe(0);
  });

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
    expect(res.body.updated).toBe(3);
    expect(mockBatch.update).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('deve dividir em múltiplos batches quando excede o limite', async () => {
    state.docStore['users/current-user'] = {
      displayName: 'Test',
      nickname: 'test',
      photoURL: null,
      bio: '',
      location: '',
    };

    // Criar 502 documentos para forçar 2 batches (limite é 500)
    const manyDocs = Array.from({ length: 502 }, (_, i) => ({
      id: `user-${i}_current-user`,
      friendId: 'current-user',
    }));
    state.queryResults['friendships'] = manyDocs;

    const res = await request(app).post('/api/friendships/sync-profile');
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(502);
    // Deve ter criado 2 batches: 500 + 2
    expect(mockDb.batch).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/friendships/mutual/:userId', () => {
  it('deve retornar vazio para o próprio usuário', async () => {
    const res = await request(app).get('/api/friendships/mutual/current-user');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.friends).toEqual([]);
  });

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
    expect(res.body.count).toBe(1);
    expect(res.body.friends[0].id).toBe('user-3');
  });

  it('deve retornar vazio quando não há amigos em comum', async () => {
    state.queryResults['friendships:0'] = [
      { id: 'f1', friendId: 'user-3', status: 'accepted', friend: {} },
    ];
    state.queryResults['friendships:1'] = [
      { id: 'f2', friendId: 'user-5', status: 'accepted', friend: {} },
    ];

    const res = await request(app).get('/api/friendships/mutual/target-user');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.friends).toEqual([]);
  });
});

describe('GET /api/friendships/status/:userId', () => {
  it('deve retornar "self" para o próprio usuário', async () => {
    const res = await request(app).get('/api/friendships/status/current-user');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('self');
  });

  it('deve retornar "none" se não houver amizade', async () => {
    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('none');
  });

  it('deve retornar "friends" se amizade for aceita', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'accepted',
      requestedBy: 'other-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('friends');
  });

  it('deve retornar "request_sent" se o usuário enviou a solicitação', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'pending',
      requestedBy: 'current-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('request_sent');
  });

  it('deve retornar "request_received" se outro enviou a solicitação', async () => {
    state.docStore['friendships/current-user_other-user'] = {
      status: 'pending',
      requestedBy: 'other-user',
    };

    const res = await request(app).get('/api/friendships/status/other-user');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('request_received');
  });
});

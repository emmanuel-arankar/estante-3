import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { admin } from '../firebase';
import { invalidatePattern } from '../lib/cache';

const { state, mockDb } = vi.hoisted(() => {
  const state = {
    docStore: {} as Record<string, any>,
    queryResults: {} as Record<string, any[]>,
  };

  const makeDocSnapshot = (id: string, data: any) => ({
    exists: data !== undefined,
    data: () => data,
    id,
  });

  const makeQuerySnapshot = (docs: any[]) => ({
    docs: docs.map(d => ({
      id: d.id,
      data: () => d,
      exists: true,
    })),
    empty: docs.length === 0,
    size: docs.length,
  });

  const mockDb = {
    collection: vi.fn((col) => ({
      doc: vi.fn((id) => {
          const path = `${col}/${id}`;
          return {
              __path: path,
              id,
              get: vi.fn(() => Promise.resolve(makeDocSnapshot(id, state.docStore[path]))),
              set: vi.fn((data) => {
                state.docStore[path] = data;
                return Promise.resolve();
              }),
              update: vi.fn((data) => {
                if (state.docStore[path]) {
                  state.docStore[path] = { ...state.docStore[path], ...data };
                }
                return Promise.resolve();
              }),
              delete: vi.fn(() => {
                delete state.docStore[path];
                return Promise.resolve();
              })
          };
      }),
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve(makeQuerySnapshot(state.queryResults[col] || [])))
        })),
        get: vi.fn(() => Promise.resolve(makeQuerySnapshot(state.queryResults[col] || [])))
      })),
      get: vi.fn(() => Promise.resolve(makeQuerySnapshot(state.queryResults[col] || []))),
      add: vi.fn(() => Promise.resolve({ id: 'new-id' }))
    })),
    runTransaction: vi.fn(async (cb) => {
      return cb({
        get: vi.fn((ref) => ref.get()),
        set: vi.fn((ref, data) => ref.set(data)),
        update: vi.fn((ref, data) => ref.update(data)),
        delete: vi.fn((ref) => ref.delete())
      });
    })
  };

  return { state, mockDb };
});

vi.mock('../firebase', () => ({
  admin: {
    auth: () => ({
      createUser: vi.fn().mockResolvedValue({ uid: 'new-user' }),
      createCustomToken: vi.fn().mockResolvedValue('token'),
      updateUser: vi.fn().mockResolvedValue({}),
    }),
    firestore: {
      Timestamp: {
        now: () => ({ toDate: () => new Date() }),
        fromDate: (d: Date) => ({ toDate: () => d })
      },
      FieldValue: {
        increment: (v: number) => ({ __type: 'increment', value: v })
      }
    }
  },
  db: mockDb,
  auth: {
      updateUser: vi.fn().mockResolvedValue({})
  }
}));

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

beforeEach(async () => {
  state.docStore = {};
  state.queryResults = {};
  vi.clearAllMocks();
  await invalidatePattern('*');
});

describe('User Operations', () => {
  it('deve buscar usuários por prefixo', async () => {
    state.queryResults['users'] = [
      { id: 'u1', nickname: 'alice', displayName: 'Alice Silva' },
    ];
    const res = await request(app).get('/api/users/search?q=ali');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nickname).toBe('alice');
  });

  it('deve retornar estatísticas do usuário logado', async () => {
    state.docStore['users/current-user'] = {
      stats: {
        friendsCount: 5,
        pendingRequestsCount: 2,
        sentRequestsCount: 1
      }
    };
    const res = await request(app).get('/api/users/me/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totalFriends).toBe(5);
  });

  it('deve retornar perfil por ID', async () => {
    state.docStore['users/u1'] = { displayName: 'Alice' };
    const res = await request(app).get('/api/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alice');
  });

  it('deve bloquear acesso se houver bloqueio', async () => {
    state.docStore['blocks/u1_current-user'] = { createdAt: new Date() };
    const res = await request(app).get('/api/users/u1');
    expect(res.status).toBe(403);
  });

  it('deve atualizar perfil completo e sincronizar com Firebase Auth', async () => {
    state.docStore['users/current-user'] = { nickname: 'antigo', displayName: 'Antigo Nome' };
    const updates = { nickname: 'novo_nick', displayName: 'Novo Nome', photoURL: 'https://new-photo.jpg', bio: 'Minha nova bio' };
    const res = await request(app).patch('/api/users/me').send(updates);
    expect(res.status).toBe(200);
    expect(state.docStore['users/current-user'].nickname).toBe('novo_nick');
  });
});

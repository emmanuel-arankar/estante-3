import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { admin, db } from '../firebase';
import { invalidatePattern } from '../lib/cache';

/**
 * @name Mock Factory Notifications
 * @summary Gerador de ambiente de notificações.
 */
const { state, mockDb, mockBatch } = vi.hoisted(() => {
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
    docs: docs.map(d => ({
      id: d.id,
      data: () => d,
      exists: true,
      ref: { __path: `notifications/${d.id}`, __id: d.id }
    })),
    empty: docs.length === 0,
    size: docs.length,
  });

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

  const makeQueryChain = (collectionName: string) => {
    let limitVal = 1000;
    let offsetVal = 0;
    const wheres: Array<{ field: string; op: string; val: any }> = [];
    const orders: Array<{ field: string; dir: string }> = [];

    const chain: any = {};
    chain.where = vi.fn((field, op, val) => { wheres.push({ field, op, val }); return chain; });
    chain.limit = vi.fn((l) => { limitVal = l; return chain; });
    chain.offset = vi.fn((o) => { offsetVal = o; return chain; });
    chain.orderBy = vi.fn((field, dir = 'asc') => { orders.push({ field, dir }); return chain; });

    const applyFilters = (baseResults: any[]) => {
      let results = [...baseResults];
      for (const f of wheres) {
        results = results.filter(r => {
          const val = f.field.split('.').reduce((obj, key) => obj?.[key], r);
          if (f.op === '==') return val === f.val;
          if (f.op === '!=') return val !== f.val;
          return true;
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
      const baseResults = state.queryResults[collectionName] || [];
      const filtered = applyFilters(baseResults);
      const sliced = filtered.slice(offsetVal, offsetVal + limitVal);
      return Promise.resolve(makeQuerySnapshot(sliced));
    });
    return chain;
  };

  const mockBatch = {
    update: vi.fn((ref: any, data: any) => {
      const path = ref.__path;
      if (state.docStore[path]) {
        state.docStore[path] = { ...state.docStore[path], ...data };
      }
    }),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb: any = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => makeDocRef(name, id)),
      ...makeQueryChain(name)
    })),
    batch: vi.fn(() => mockBatch),
  };

  return { state, mockDb, mockBatch };
});

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestoreFn: any = () => mockDb;
  firestoreFn.Timestamp = {
    now: () => ({
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now()
    }),
  };
  firestoreFn.FieldValue = {
    increment: (n: number) => ({ __increment: n }),
  };

  return {
    default: {
      apps: [{}],
      initializeApp: vi.fn(),
      firestore: firestoreFn,
      auth: () => ({ verifySessionCookie: vi.fn() }),
      database: () => ({ ref: vi.fn() }),
      storage: () => ({ bucket: vi.fn() }),
    },
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    admin: { firestore: firestoreFn, auth: () => ({ updateUser: vi.fn() }), database: () => ({ ref: vi.fn() }), storage: () => ({ bucket: vi.fn() }) }, auth: () => ({ verifySessionCookie: vi.fn() }), database: () => ({ ref: vi.fn() }), storage: () => ({ bucket: vi.fn() }),
    db: mockDb,
  };
});

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
  state.queryCallCount = {};
  vi.clearAllMocks();
  await invalidatePattern('*');
});

const makeNotification = (id: string, type = 'friend_request', read = false) => ({
  id,
  userId: 'current-user',
  type,
  actorId: 'other-user',
  actorName: 'Other User',
  read,
  createdAt: { toDate: () => new Date(), toMillis: () => Date.now(), seconds: 123, nanoseconds: 0 },
});

describe('Notification Operations', () => {
  it('deve retornar lista vazia quando não há notificações', async () => {
    state.queryResults['notifications'] = [];
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
  });

  it('deve listar notificações com paginação', async () => {
    state.queryResults['notifications'] = [
      makeNotification('n1'),
      makeNotification('n2'),
      makeNotification('n3'),
    ];
    const res = await request(app).get('/api/notifications?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
  });

  it('deve marcar notificação como lida', async () => {
    state.docStore['notifications/n1'] = { userId: 'current-user', read: false };
    const res = await request(app).post('/api/notifications/n1/read');
    expect(res.status).toBe(200);
    expect(state.docStore['notifications/n1'].read).toBe(true);
  });

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

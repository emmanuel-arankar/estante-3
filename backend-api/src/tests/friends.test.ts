import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { db } from '../firebase';
import { invalidatePattern } from '../lib/cache';

const { state, mockDb } = vi.hoisted(() => {
    const state = {
        docStore: {} as Record<string, any>,
    };

    const makeDocSnapshot = (id: string, data: any) => ({
        exists: data !== undefined,
        data: () => data,
        id,
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
                    }),
                    select: vi.fn(() => ({
                        get: vi.fn(() => Promise.resolve({
                            docs: Object.entries(state.docStore)
                                .filter(([p]) => p.startsWith(col))
                                .map(([p, d]) => ({ id: p.split('/')[1], data: () => d }))
                        }))
                    }))
                };
            }),
            where: vi.fn(() => ({
                where: vi.fn(() => ({
                    select: vi.fn(() => ({
                        get: vi.fn(() => Promise.resolve({ docs: [] }))
                    })),
                    get: vi.fn(() => Promise.resolve({ docs: [] }))
                })),
                select: vi.fn(() => ({
                    get: vi.fn(() => Promise.resolve({ docs: [] }))
                })),
                get: vi.fn(() => Promise.resolve({ docs: [] }))
            })),
            add: vi.fn(() => Promise.resolve({ id: 'new-id' }))
        })),
        batch: vi.fn(() => ({
            set: vi.fn((ref, data, options) => {
                const path = ref.__path;
                if (options?.merge && state.docStore[path]) {
                    state.docStore[path] = { ...state.docStore[path], ...data };
                } else {
                    state.docStore[path] = data;
                }
            }),
            update: vi.fn((ref, data) => {
                const path = ref.__path;
                if (state.docStore[path]) state.docStore[path] = { ...state.docStore[path], ...data };
            }),
            delete: vi.fn((ref) => { delete state.docStore[ref.__path]; }),
            commit: vi.fn(() => Promise.resolve())
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
        auth: () => ({}),
        firestore: {
            Timestamp: {
                now: () => ({ toDate: () => new Date() })
            },
            FieldValue: {
                increment: (v: number) => ({ __type: 'increment', value: v })
            }
        }
    },
    db: mockDb,
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

describe('Friendship Operations', () => {
    beforeEach(async () => {
        state.docStore = {};
        vi.clearAllMocks();
        await invalidatePattern('*');
    });

    describe('POST /api/friendships/request', () => {
        it('deve enviar uma solicitação de amizade', async () => {
            state.docStore['users/current-user'] = { uid: 'current-user' };
            state.docStore['users/user-b'] = { uid: 'user-b' };

            const res = await request(app)
                .post('/api/friendships/request')
                .send({ targetUserId: 'user-b' });

            expect(res.status).toBe(201);
        });
    });

    describe('POST /api/friendships/:friendshipId/accept', () => {
        it('deve aceitar uma solicitação pendente', async () => {
            const friendshipId = 'user-b_current-user';
            state.docStore[`friendships/${friendshipId}`] = {
                status: 'pending',
                requestedBy: 'user-b',
                userId: 'current-user',
                friendId: 'user-b'
            };
            state.docStore[`friendships/current-user_user-b`] = { ...state.docStore[`friendships/${friendshipId}`] };

            state.docStore['users/current-user'] = { uid: 'current-user' };
            state.docStore['users/user-b'] = { uid: 'user-b' };

            const res = await request(app)
                .post(`/api/friendships/${friendshipId}/accept`);

            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/friendships/:friendshipId', () => {
        it('deve remover uma amizade ou solicitação', async () => {
            const friendshipId = 'current-user_user-b';
            state.docStore[`friendships/${friendshipId}`] = { status: 'accepted', userId: 'current-user', friendId: 'user-b' };
            state.docStore[`friendships/user-b_current-user`] = { status: 'accepted', userId: 'user-b', friendId: 'current-user' };

            const res = await request(app)
                .delete(`/api/friendships/${friendshipId}`);

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/friendships/status/:userId', () => {
        it('deve retornar "none" se não houver amizade', async () => {
            const res = await request(app).get('/api/friendships/status/user-b');
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('none');
        });
    });
});

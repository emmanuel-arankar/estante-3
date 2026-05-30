import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { admin, db, rtdb } from '../firebase';

/**
 * @name Mock Factory Chat
 * @summary Gerador de ambiente de chat para testes.
 */
const { state, mockDb, mockRtdb } = vi.hoisted(() => {
    const state = {
        docStore: {} as Record<string, any>,
        rtdbStore: {} as Record<string, any>,
    };

    const mockDb = {
        collection: vi.fn((col) => ({
            doc: vi.fn((id) => ({
                get: vi.fn(() => Promise.resolve({
                    exists: state.docStore[`${col}/${id}`] !== undefined,
                    data: () => state.docStore[`${col}/${id}`],
                    id
                })),
                update: vi.fn((data) => {
                    if (state.docStore[`${col}/${id}`]) {
                        state.docStore[`${col}/${id}`] = { ...state.docStore[`${col}/${id}`], ...data };
                    }
                    return Promise.resolve();
                })
            }))
        }))
    };

    const mockRtdb = {
        ref: vi.fn((path = '') => ({
            set: vi.fn((val) => {
                state.rtdbStore[path] = val;
                return Promise.resolve();
            }),
            update: vi.fn((updates) => {
                if (path) {
                    state.rtdbStore[path] = { ...(state.rtdbStore[path] || {}), ...updates };
                } else {
                    Object.entries(updates).forEach(([key, val]) => {
                        state.rtdbStore[key] = val;
                    });
                }
                return Promise.resolve();
            }),
            push: vi.fn(() => ({
                key: 'mock-msg-id',
                set: vi.fn((val) => {
                    state.rtdbStore[`${path}/mock-msg-id`] = val;
                    return Promise.resolve();
                })
            })),
            get: vi.fn(() => Promise.resolve({
                exists: () => state.rtdbStore[path] !== undefined,
                val: () => state.rtdbStore[path]
            })),
            transaction: vi.fn(async (cb) => {
                const current = state.rtdbStore[path] || null;
                const result = cb(current);
                state.rtdbStore[path] = result;
                return Promise.resolve({ committed: true, snapshot: { val: () => result } });
            })
        }))
    };

    return { state, mockDb, mockRtdb };
});

// Mocking Firebase Admin
vi.mock('../firebase', () => ({
    admin: {
        database: {
            ServerValue: {
                TIMESTAMP: 'mock-timestamp',
                increment: (val: number) => ({ __attr: 'increment', val }),
            }
        }
    },
    db: mockDb,
    rtdb: mockRtdb
}));

// Mocking Auth Middleware
vi.mock('../middleware/auth.middleware', () => ({
    checkAuthOptional: vi.fn((req: any, _res: any, next: any) => { req.user = { uid: 'current-user' }; next(); }),
    checkAuth: vi.fn((req: any, _res: any, next: any) => {
        req.user = { uid: 'current-user' };
        next();
    }),
}));

describe('Chat Operations', () => {
    beforeEach(() => {
        state.docStore = {};
        state.rtdbStore = {};
        vi.clearAllMocks();
    });

    it('deve atualizar status de presença', async () => {
        const res = await request(app)
            .post('/api/chat/presence')
            .send({ online: true });

        expect(res.status).toBe(200);
        expect(state.rtdbStore['status/current-user'].online).toBe(true);
    });

    it('deve atualizar status de digitação', async () => {
        const res = await request(app)
            .post('/api/chat/typing')
            .send({ receiverId: 'user-b', status: 'recording' });

        expect(res.status).toBe(200);
        expect(state.rtdbStore['typing/user-b/current-user']).toBe('recording');
    });

    it('deve enviar uma mensagem e atualizar previews', async () => {
        state.docStore['users/current-user'] = { displayName: 'Me', photoURL: 'url-me' };
        state.docStore['users/user-b'] = { displayName: 'User B', photoURL: 'url-b' };

        const res = await request(app)
            .post('/api/chat/messages')
            .send({
                receiverId: 'user-b',
                content: 'Olá!',
                type: 'text'
            });

        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe('mock-msg-id');

        // Verificar se a mensagem foi gravada no path correto
        // O getChatId ordena IDs: current-user_user-b
        const chatId = ['current-user', 'user-b'].sort().join('_');
        expect(state.rtdbStore[`chats/${chatId}/messages/mock-msg-id`]).toMatchObject({
            senderId: 'current-user',
            content: 'Olá!',
            type: 'text'
        });

        // Verificar previews denormalizados
        expect(state.rtdbStore[`userChats/current-user/user-b`].lastMessage).toBe('Olá!');
        expect(state.rtdbStore[`userChats/user-b/current-user`].unreadCount).toMatchObject({ __attr: 'increment', val: 1 });
    });

    it('deve gerenciar reações com transação', async () => {
        const chatId = ['current-user', 'user-b'].sort().join('_');
        const msgPath = `chats/${chatId}/messages/m1/reactions`;

        // Teste de adicionar reação
        await request(app)
            .post('/api/chat/messages/m1/react')
            .send({ otherId: 'user-b', emoji: '👍' });

        expect(state.rtdbStore[msgPath]).toEqual({ '👍': ['current-user'] });

        // Teste de remover reação (mesmo endpoint alterna)
        await request(app)
            .post('/api/chat/messages/m1/react')
            .send({ otherId: 'user-b', emoji: '👍' });

        expect(state.rtdbStore[msgPath]).toBeNull();
    });

    it('deve solicitar transcrição (mock de mediação)', async () => {
        const res = await request(app)
            .post('/api/chat/transcription')
            .send({ chatId: 'c1', messageId: 'm1' });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
        expect(res.body.data.transcription).toContain('Backend Mediated');
    });
});

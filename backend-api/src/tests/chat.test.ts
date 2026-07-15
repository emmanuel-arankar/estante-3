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

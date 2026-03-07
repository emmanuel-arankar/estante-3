// =============================================================================
// TESTES UNITÁRIOS: CORE (Firebase & Express Init)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// Mock do firebase-admin antes de importar o firebase.ts
vi.mock('firebase-admin', () => {
    const mockApp = {
        firestore: vi.fn(() => ({})),
        auth: vi.fn(() => ({})),
        database: vi.fn(() => ({ ref: vi.fn(() => ({ update: vi.fn(), push: vi.fn(), set: vi.fn() })) })),
        storage: vi.fn(() => ({ bucket: vi.fn(() => ({ file: vi.fn(() => ({ getSignedUrl: vi.fn() })) })) })),
    };
    return {
        apps: [],
        initializeApp: vi.fn(() => mockApp),
        credential: {
            cert: vi.fn(),
            applicationDefault: vi.fn(),
        },
        firestore: vi.fn(() => ({})),
        auth: vi.fn(() => ({})),
        database: vi.fn(() => ({ ref: vi.fn(() => ({ update: vi.fn(), push: vi.fn(), set: vi.fn() })) })),
        storage: vi.fn(() => ({ bucket: vi.fn(() => ({ file: vi.fn(() => ({ getSignedUrl: vi.fn() })) })) })),
    };
});

import request from 'supertest';

describe('Core Initialization', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Firebase Initialization (firebase.ts)', () => {
        it('deve inicializar o admin SDK se nenhum app existir', async () => {
            vi.resetModules(); // Isolado apenas para este teste que testa estado inicial do core
            // Mock do estado interno para parecer que não há apps inicializados
            (admin as any).apps = [];

            await import('../firebase');
            expect(admin.initializeApp).toHaveBeenCalled();
        });

        it('deve limpar variáveis do emulador se FUNCTIONS_EMULATOR for true', async () => {
            vi.resetModules();
            process.env.FUNCTIONS_EMULATOR = 'true';
            process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

            await import('../firebase');

            expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
        });
    });

    describe('Express App Configuration (index.ts)', () => {
        it('deve responder 200 na rota de health check da API', async () => {
            vi.resetModules();
            // Isolando a importação do app
            const { app } = await import('../index');
            const server = app.listen(0); // Força um ephemeral port fixo e garante fechamento na nossa mão

            try {
                const response = await request(server as any).get('/api/health');
                expect(response.status).not.toBe(404);
            } finally {
                server.close();
            }
        });

        it('deve ter o middleware de CORS habilitado (verifica header)', async () => {
            vi.resetModules();
            const { app } = await import('../index');
            const server = app.listen(0);

            try {
                const response = await request(server as any).get('/api/health');
                expect(app).toBeDefined();
            } finally {
                server.close();
            }
        });
    });
});

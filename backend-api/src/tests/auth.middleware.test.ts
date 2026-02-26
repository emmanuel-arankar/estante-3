// =============================================================================
// TESTES UNITÁRIOS: AUTH MIDDLEWARE
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAuth } from '../middleware/auth.middleware';
import * as admin from 'firebase-admin';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

// Objeto de mock persistente para Auth
const authInstanceMock = {
    verifySessionCookie: vi.fn(),
    verifyIdToken: vi.fn(),
};

// Mock do Firebase Admin
vi.mock('firebase-admin', () => ({
    auth: vi.fn(() => authInstanceMock),
    database: vi.fn(() => ({ ref: vi.fn(() => ({ update: vi.fn(), push: vi.fn(), set: vi.fn() })) })),
    storage: vi.fn(() => ({ bucket: vi.fn(() => ({ file: vi.fn(() => ({ getSignedUrl: vi.fn() })) })) })),
}));

// Mock do Logger
vi.mock('firebase-functions/logger', () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}));

describe('AuthMiddleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup básico de objetos Express
        req = {
            cookies: {},
            headers: {},
            path: '/test'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    // =============================================================================
    // TESTES: Autenticação via Session Cookie
    // =============================================================================

    describe('Session Cookie', () => {
        it('deve autenticar com sucesso via cookie válido', async () => {
            const mockUser = { uid: 'user123', email: 'test@example.com' };
            req.cookies.__session = 'valid-cookie';

            authInstanceMock.verifySessionCookie.mockResolvedValue(mockUser);

            await checkAuth(req, res, next);

            expect(authInstanceMock.verifySessionCookie).toHaveBeenCalledWith('valid-cookie', true);
            expect(req.user).toEqual(mockUser);
            expect(next).toHaveBeenCalled();
        });

        it('deve retornar 401 se o cookie for revogado', async () => {
            req.cookies.__session = 'revoked-cookie';

            authInstanceMock.verifySessionCookie.mockRejectedValue({ code: 'auth/session-cookie-revoked' });

            await checkAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ error: 'Sua sessão foi revogada. Faça login novamente.' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    // =============================================================================
    // TESTES: Autenticação via ID Token (Authorization Header)
    // =============================================================================

    describe('ID Token (Authorization Header)', () => {
        it('deve autenticar com sucesso via Token ID válido', async () => {
            const mockUser = { uid: 'user456', email: 'token@example.com' };
            req.headers.authorization = 'Bearer valid-token';

            authInstanceMock.verifyIdToken.mockResolvedValue(mockUser);

            await checkAuth(req, res, next);

            expect(authInstanceMock.verifyIdToken).toHaveBeenCalledWith('valid-token');
            expect(req.user).toEqual(mockUser);
            expect(next).toHaveBeenCalled();
        });

        it('deve tentar o Header se o Cookie falhar (Fallback)', async () => {
            const mockUser = { uid: 'user-fallback', email: 'fallback@example.com' };
            req.cookies.__session = 'invalid-cookie';
            req.headers.authorization = 'Bearer valid-token';

            // Cookie falha
            authInstanceMock.verifySessionCookie.mockRejectedValue(new Error('Invalid cookie'));
            // Token funciona
            authInstanceMock.verifyIdToken.mockResolvedValue(mockUser);

            await checkAuth(req, res, next);

            expect(authInstanceMock.verifySessionCookie).toHaveBeenCalled();
            expect(authInstanceMock.verifyIdToken).toHaveBeenCalledWith('valid-token');
            expect(req.user).toEqual(mockUser);
            expect(next).toHaveBeenCalled();
        });

        it('deve retornar 401 se o ID Token for inválido', async () => {
            req.headers.authorization = 'Bearer invalid-token';

            authInstanceMock.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

            await checkAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ error: 'Token de autenticação inválido ou expirado.' });
        });
    });

    // =============================================================================
    // TESTES: Casos de Falha Geral
    // =============================================================================

    describe('Cenários de Falha', () => {
        it('deve retornar 401 se não houver cookie nem header', async () => {
            await checkAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ error: 'Não autenticado. Faça login.' });
        });

        it('deve retornar 401 se existir cookie inválido e não houver header', async () => {
            req.cookies.__session = 'garbage';

            authInstanceMock.verifySessionCookie.mockRejectedValue(new Error('Garbage session'));

            await checkAuth(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith({ error: 'Sessão inválida. Faça login novamente.' });
        });
    });
});

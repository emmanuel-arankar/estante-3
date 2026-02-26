import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { checkRole } from '../middleware/roles.middleware';
import { responseWrapper } from '../middleware/response.middleware';
import { requestIdMiddleware } from '../middleware/requestId.middleware';

// Mocks Globais do Firestore
const mockGet = vi.fn();
const mockDocRef = vi.fn(() => ({ get: mockGet }));
const mockCollection = vi.fn((_name: string) => ({ doc: mockDocRef }));

vi.mock('../firebase', () => ({
    db: {
        collection: (name: string) => mockCollection(name)
    }
}));

describe('Middleware de RBAC (Controle de Acesso Baseado em Cargos)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    // Mock de autenticação para simular um usuário logado
    const mockAuth = (req: any, _res: any, next: any) => {
        req.user = { uid: 'test-user-id' };
        next();
    };

    // Rota simulada apenas para Administradores
    testApp.get('/admin', mockAuth, checkRole(['admin']), (req, res) => {
        res.json({ message: 'Bem-vindo Admin' });
    });

    // Rota simulada para Bibliotecários ou Administradores
    testApp.get('/librarian', mockAuth, checkRole(['librarian', 'admin']), (req, res) => {
        res.json({ message: 'Bem-vindo Bibliotecário' });
    });

    // Rota simulada para Gerentes, Assistentes ou Administradores
    testApp.get('/manager', mockAuth, checkRole(['manager', 'assistant', 'admin']), (req, res) => {
        res.json({ message: 'Bem-vindo Gerente' });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve permitir acesso se o usuário tiver o cargo exato (admin)', async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ role: 'admin' })
        });

        const res = await request(testApp).get('/admin');

        expect(res.status).toBe(200);
        expect(res.body.data.message).toBe('Bem-vindo Admin');
    });

    it('deve negar acesso (403) se o usuário for apenas "user" acessando rota de "admin"', async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ role: 'user' })
        });

        const res = await request(testApp).get('/admin');

        expect(res.status).toBe(403);
        expect(res.body.error.error).toContain('permissão');
    });

    it('deve permitir acesso a cargos múltiplos (librarian acessando rota permitida para librarian/admin)', async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ role: 'librarian' })
        });

        const res = await request(testApp).get('/librarian');

        expect(res.status).toBe(200);
        expect(res.body.data.message).toBe('Bem-vindo Bibliotecário');
    });

    it('deve permitir acesso de cargo superior (admin acessando rota de librarian)', async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ role: 'admin' })
        });

        const res = await request(testApp).get('/librarian');

        expect(res.status).toBe(200);
        expect(res.body.data.message).toBe('Bem-vindo Bibliotecário');
    });

    it('deve fazer fallback para "user" se o campo role estiver ausente no documento', async () => {
        mockGet.mockResolvedValue({
            exists: true,
            data: () => ({ nickname: 'testuser' }) // Documento sem o campo role
        });

        const res = await request(testApp).get('/admin');

        expect(res.status).toBe(403);
        expect(res.body.error.error).toContain('permissão');
    });

    it('deve retornar 404 se o documento do usuário não existir no Firestore', async () => {
        mockGet.mockResolvedValue({
            exists: false
        });

        const res = await request(testApp).get('/admin');

        expect(res.status).toBe(404);
        expect(res.body.error.error).toContain('não encontrado');
    });
});

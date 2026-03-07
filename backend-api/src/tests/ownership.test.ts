import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { checkOwnership, checkStorageOwnership } from '../middleware/ownership.middleware';
import { requestIdMiddleware } from '../middleware/requestId.middleware';
import { responseWrapper } from '../middleware/response.middleware';

// Mocks do Firestore
const mockGet = vi.fn();
const mockDocRef = vi.fn(() => ({ get: mockGet }));
const mockCollection = vi.fn((_name: string) => ({ doc: mockDocRef }));

vi.mock('../firebase', () => ({
    db: {
        collection: (name: string) => mockCollection(name)
    }
}));

describe('Middleware de Propriedade (ownership.middleware)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    // Mock de usuário autenticado
    const mockAuth = (req: any, _res: any, next: any) => {
        req.user = { uid: 'owner-123' };
        next();
    };

    // Rota de teste para Ownership no Firestore
    testApp.get('/test-ownership/:id', mockAuth, checkOwnership({ collection: 'testColl', paramName: 'id' }), (req: any, res) => {
        res.json({ success: true, data: req.resourceData });
    });

    // Rota de teste para Ownership no Storage
    testApp.post('/test-storage-ownership', mockAuth, checkStorageOwnership, (req, res) => {
        res.json({ success: true });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve permitir acesso se o usuário for o dono (Firestore)', async () => {
        const mockDoc = {
            exists: true,
            data: () => ({ userId: 'owner-123', content: 'secreto' })
        };
        mockGet.mockResolvedValue(mockDoc);

        const res = await request(testApp).get('/test-ownership/doc-123');

        expect(res.status).toBe(200);
        expect(res.body.data.data.content).toBe('secreto');
    });

    it('deve negar acesso (403) se o usuário não for o dono (Firestore)', async () => {
        const mockDoc = {
            exists: true,
            data: () => ({ userId: 'outro-usuario', content: 'secreto' })
        };
        mockGet.mockResolvedValue(mockDoc);

        const res = await request(testApp).get('/test-ownership/doc-123');

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Acesso negado');
    });

    it('deve retornar 404 se o recurso não existir no Firestore', async () => {
        mockGet.mockResolvedValue({ exists: false });

        const res = await request(testApp).get('/test-ownership/doc-nenhum');

        expect(res.status).toBe(404);
    });

    it('deve permitir acesso se o caminho do Storage contiver o userId', async () => {
        const res = await request(testApp)
            .post('/test-storage-ownership')
            .send({ path: 'avatares/owner-123/foto.jpg' });

        expect(res.status).toBe(200);
    });

    it('deve negar acesso (403) se o caminho do Storage não contiver o userId', async () => {
        const res = await request(testApp)
            .post('/test-storage-ownership')
            .send({ path: 'avatares/hacker-999/foto.jpg' });

        expect(res.status).toBe(403);
    });
});

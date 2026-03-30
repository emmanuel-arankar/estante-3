import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { bucket } from '../firebase';

/**
 * @name Mock Factory Storage
 * @summary Gerador de ambiente de storage para testes.
 */
const { mockBucket } = vi.hoisted(() => {
    const mockFile = (path: string) => ({
        getSignedUrl: vi.fn(() => Promise.resolve([`https://signed-url.com/${path}`])),
        exists: vi.fn(() => Promise.resolve([path.includes('exists')])),
        delete: vi.fn(() => Promise.resolve()),
    });

    const mockBucket = {
        name: 'test-bucket',
        file: vi.fn((path) => mockFile(path)),
    };

    return { mockBucket };
});

// Mocking Firebase Admin
vi.mock('../firebase', () => ({
    admin: {
        auth: () => ({}),
    },
    bucket: mockBucket,
}));

// Mocking Auth Middleware
import { Request, Response, NextFunction } from 'express';

vi.mock('../middleware/auth.middleware', () => ({
    checkAuth: vi.fn((req: Request & { user?: { uid: string } }, _res: Response, next: NextFunction) => {
        req.user = { uid: 'current-user' };
        next();
    }),
    checkAuthOptional: vi.fn((req: Request & { user?: { uid: string } }, _res: Response, next: NextFunction) => {
        req.user = { uid: 'current-user' };
        next();
    }),
}));

describe('Storage Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve gerar uma URL assinada para upload', async () => {
        const res = await request(app)
            .post('/api/storage/signed-url')
            .send({
                fileName: 'test.jpg',
                contentType: 'image/jpeg',
                folder: 'avatars'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.uploadUrl).toContain('https://signed-url.com/');
        expect(res.body.data.path).toContain('avatars/current-user/');
        expect(mockBucket.file).toHaveBeenCalled();
    });

    it('deve permitir apagar o próprio arquivo', async () => {
        const filePath = 'avatars/current-user/exists_file.jpg';

        const res = await request(app)
            .delete('/api/storage')
            .send({ path: filePath });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
    });

    it('deve bloquear a exclusão de arquivo de outro usuário', async () => {
        const filePath = 'avatars/other-user/exists_file.jpg';

        const res = await request(app)
            .delete('/api/storage')
            .send({ path: filePath });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Acesso negado');
    });

    it('deve retornar 404 se o arquivo não existir', async () => {
        const filePath = 'avatars/current-user/not_found.jpg';

        const res = await request(app)
            .delete('/api/storage')
            .send({ path: filePath });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('não encontrado');
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

// Mocking Firebase
const { mockBucket } = vi.hoisted(() => ({
    mockBucket: {
        file: vi.fn(() => ({
            getSignedUrl: vi.fn().mockResolvedValue(['https://mock-signed-url']),
            exists: vi.fn().mockResolvedValue([true]),
            delete: vi.fn().mockResolvedValue(undefined),
        })),
        name: 'mock-bucket',
    }
}));

vi.mock('../firebase', () => {
    const mockDb = {
        collection: vi.fn(() => ({
            add: vi.fn().mockResolvedValue({ id: 'new-audit-id' }),
            doc: vi.fn(() => ({
                set: vi.fn().mockResolvedValue({}),
                get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) })
            })),
        })),
    };
    return {
        admin: {
            auth: () => ({}),
            database: () => ({}),
        },
        db: mockDb,
        bucket: mockBucket,
    };
});

// Mocking Auth Middleware
vi.mock('../middleware/auth.middleware', () => ({
    checkAuth: vi.fn((req: any, _res: any, next: any) => { req.user = { uid: 'current-user' }; next(); }),
    checkAuthOptional: vi.fn((req: any, _res: any, next: any) => { req.user = { uid: 'current-user' }; next(); }),
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
        // O backend usa um responseWrapper: { status: 'success', data: { ... } }
        expect(res.body.data).toHaveProperty('uploadUrl');
        expect(res.body.data.path).toContain('avatars/current-user/');
    });

    it('deve permitir apagar o próprio arquivo', async () => {
        const res = await request(app)
            .delete('/api/storage')
            .send({ path: 'avatars/current-user/exists_file.jpg' });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
    });

    it('deve bloquear a exclusão de arquivo de outro usuário', async () => {
        const res = await request(app)
            .delete('/api/storage')
            .send({ path: 'avatars/other-user/exists_file.jpg' });

        expect(res.status).toBe(403);
    });

    it('deve retornar 404 se o arquivo não existir', async () => {
        (mockBucket.file as any).mockReturnValueOnce({
            exists: vi.fn().mockResolvedValue([false]),
        });

        const res = await request(app)
            .delete('/api/storage')
            .send({ path: 'avatars/current-user/missing.jpg' });

        expect(res.status).toBe(404);
    });
});

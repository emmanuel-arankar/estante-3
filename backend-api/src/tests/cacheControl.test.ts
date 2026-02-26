import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cacheControlMiddleware } from '../middleware/cacheControl.middleware';

describe('Cache-Control Middleware', () => {
    const app = express();
    app.use(cacheControlMiddleware);

    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/users/me', (_req, res) => res.json({ user: 'data' }));
    app.post('/api/chat/messages', (_req, res) => res.status(201).json({ id: 'msg-1' }));
    app.delete('/api/storage', (_req, res) => res.json({ success: true }));

    it('deve permitir cache público (5min) para a rota de health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['cache-control']).toBe('public, max-age=300');
    });

    it('deve bloquear cache (no-store) para rotas dinâmicas de dados privados (GET)', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['cache-control']).toContain('max-age=0');
        expect(res.headers['pragma']).toBe('no-cache');
    });

    it('deve bloquear cache (no-store) para operações de escrita (POST)', async () => {
        const res = await request(app).post('/api/chat/messages');
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['pragma']).toBe('no-cache');
    });

    it('deve bloquear cache (no-store) para operações de exclusão (DELETE)', async () => {
        const res = await request(app).delete('/api/storage');
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['pragma']).toBe('no-cache');
    });

    it('deve incluir headers de expiração legados (Expires: 0) para no-store', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.headers['expires']).toBe('0');
    });
});

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { securityHeadersMiddleware } from '../middleware/securityHeaders.middleware';

describe('Security Headers Middleware', () => {
    const app = express();
    app.use(securityHeadersMiddleware);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    it('deve incluir o cabeçalho X-Frame-Options: DENY', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('deve incluir o cabeçalho X-Content-Type-Options: nosniff', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('deve incluir o cabeçalho Strict-Transport-Security correto', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
        expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
    });

    it('deve incluir a política de segurança de conteúdo (CSP) restritiva', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['content-security-policy']).toContain("default-src 'none'");
        expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    it('deve incluir o cabeçalho Referrer-Policy: no-referrer', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    it('deve incluir o cabeçalho Permissions-Policy restritivo', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['permissions-policy']).toContain('camera=()');
    });

    it('deve desativar o filtro XSS legado (X-XSS-Protection: 0)', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-xss-protection']).toBe('0');
    });

    it('deve remover o cabeçalho X-Powered-By por segurança', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});

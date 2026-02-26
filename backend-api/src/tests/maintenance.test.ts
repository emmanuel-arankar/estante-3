import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { maintenanceMiddleware } from '../middleware/maintenance.middleware';
import { responseWrapper } from '../middleware/response.middleware';
import { requestIdMiddleware } from '../middleware/requestId.middleware';

describe('Middleware de Modo Manutenção (maintenance.middleware)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    testApp.get('/test-manutencao', maintenanceMiddleware, (req, res) => {
        res.json({ status: 'online' });
    });

    testApp.post('/test-manutencao', maintenanceMiddleware, (req, res) => {
        res.json({ status: 'criado' });
    });

    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    it('deve permitir acesso total quando MAINTENANCE_MODE não é true', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'false');

        const resGet = await request(testApp).get('/test-manutencao');
        const resPost = await request(testApp).post('/test-manutencao');

        expect(resGet.status).toBe(200);
        expect(resPost.status).toBe(200);
    });

    it('deve permitir GET mas bloquear POST (503) em manutenção', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'true');

        const resGet = await request(testApp).get('/test-manutencao');
        const resPost = await request(testApp).post('/test-manutencao');

        expect(resGet.status).toBe(200);
        expect(resPost.status).toBe(503);
        expect(resPost.body.error.error).toContain('manutenção');
    });
});

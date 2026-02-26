import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requestIdMiddleware } from '../middleware/requestId.middleware';

describe('Middleware de ID de Requisição (requestId.middleware)', () => {
    const testApp = express();

    testApp.use(requestIdMiddleware);

    testApp.get('/test-request-id', (req: any, res) => {
        res.json({ requestId: req.requestId });
    });

    it('deve gerar e retornar o cabeçalho X-Request-Id', async () => {
        const res = await request(testApp).get('/test-request-id');
        expect(res.header['x-request-id']).toBeDefined();
        // Verifica se o ID no corpo da resposta (injetado via req.requestId) é o mesmo do cabeçalho
        expect(res.body.requestId).toBe(res.header['x-request-id']);
    });

    it('deve preservar o cabeçalho X-Request-Id se já fornecido na requisição', async () => {
        const idExistente = 'id-fixo-123';
        const res = await request(testApp)
            .get('/test-request-id')
            .set('X-Request-Id', idExistente);

        expect(res.header['x-request-id']).toBe(idExistente);
        expect(res.body.requestId).toBe(idExistente);
    });
});

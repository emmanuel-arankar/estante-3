import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { responseWrapper } from '../middleware/response.middleware';
import { requestIdMiddleware } from '../middleware/requestId.middleware';

describe('Middleware de Padronização de Resposta (response.middleware)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    // Rota para Teste de Padronização de Sucesso
    testApp.get('/test-sucesso', (_req, res) => {
        res.status(200).json({ foo: 'bar' });
    });

    // Rota para Teste de Padronização de Erro
    testApp.get('/test-erro', (_req, res) => {
        res.status(400).json({ detalhe: 'algo deu errado' });
    });

    it('deve formatar respostas de sucesso corretamente', async () => {
        const res = await request(testApp).get('/test-sucesso');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.requestId).toBeDefined();
        expect(res.body.data.foo).toBe('bar');
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.timestamp).toBeDefined();
    });

    it('deve formatar respostas de erro corretamente', async () => {
        const res = await request(testApp).get('/test-erro');

        expect(res.status).toBe(400);
        expect(res.body.status).toBe('error');
        expect(res.body.requestId).toBeDefined();
        expect(res.body.error.detalhe).toBe('algo deu errado');
        expect(res.body.meta).toBeDefined();
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authLimiter } from '../middleware/security.middleware';
import { requestIdMiddleware } from '../middleware/requestId.middleware';
import { responseWrapper } from '../middleware/response.middleware';

describe('Middleware de Segurança (security.middleware - Rate Limit)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    // Rota de teste para Rate Limit (específica de autenticação - 10 requisições)
    testApp.get('/test-limit', authLimiter as any, (req, res) => {
        res.send('ok');
    });

    beforeEach(() => {
        // O rate limit usa o IP, então em testes ele pode persistir entre os casos se não for resetado.
        // Como o express-rate-limit não é trivial de resetar sem expor a store, 
        // relyaremos no fato de que o testApp é reiniciado ou o limite é alto o suficiente.
    });

    it('deve aplicar rate limit após múltiplas chamadas', async () => {
        // O authLimiter está configurado para 10 no ambiente de teste/mock.
        const results = [];
        for (let i = 0; i < 15; i++) {
            results.push(await request(testApp).get('/test-limit'));
        }

        const rateLimited = results.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
        expect(rateLimited[0].body.error.error).toContain('Muitas tentativas');
    });
});

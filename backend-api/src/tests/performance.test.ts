import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { performanceMiddleware } from '../middleware/performance.middleware';
import * as logger from 'firebase-functions/logger';

// Mock do Logger para capturar o aviso
vi.mock('firebase-functions/logger', () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));

describe('Middleware de Performance (Detector de Requisições Lentas)', () => {
    const testApp = express();
    testApp.use(express.json());

    // Configura o middleware com threshold baixo (500ms) para facilitar o teste
    testApp.use(performanceMiddleware(500));

    // Rota rápida (deve passar sem alert)
    testApp.get('/fast', (req, res) => {
        res.json({ ok: true });
    });

    // Rota lenta (deve disparar alert)
    testApp.get('/slow', async (req, res) => {
        await new Promise(resolve => setTimeout(resolve, 700)); // Espera 700ms ( > 500ms)
        res.json({ slow: true });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('não deve logar aviso para requisições rápidas', async () => {
        const res = await request(testApp).get('/fast');
        expect(res.status).toBe(200);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('deve logar um aviso (logger.warn) quando a requisição excede o threshold', async () => {
        const res = await request(testApp).get('/slow');
        expect(res.status).toBe(200);

        // O logger.warn deve ter sido chamado com a mensagem 'Slow Request Detected'
        expect(logger.warn).toHaveBeenCalledWith(
            'Slow Request Detected',
            expect.objectContaining({
                method: 'GET',
                path: '/slow',
                durationMs: expect.any(Number),
                thresholdMs: 500
            })
        );

        // Verifica se a duração registrada é maior ou igual ao threshold
        const callArgs = (logger.warn as any).mock.calls[0][1];
        expect(callArgs.durationMs).toBeGreaterThanOrEqual(500);
    });
});

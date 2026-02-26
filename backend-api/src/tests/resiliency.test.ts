import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { timeoutMiddleware } from '../middleware/timeout.middleware';
import { CircuitBreaker, CircuitState } from '../lib/circuitBreaker';
import * as redisModule from '../lib/redis';

// Mock do logger para evitar poluição no console durante testes
vi.mock('firebase-functions/logger', () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
}));

// Mock do Redis
const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
};

vi.mock('../lib/redis', () => ({
    getRedis: () => mockRedis,
}));

describe('Infraestrutura de Resiliência', () => {

    describe('Timeout Middleware', () => {
        const app = express();
        // Timeout agressivo de 50ms para testes
        app.use(timeoutMiddleware(50));

        app.get('/slow', async (req, res) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!res.headersSent) {
                res.json({ message: 'too late' });
            }
        });

        app.get('/fast', (req, res) => {
            res.json({ message: 'im fast' });
        });

        it('deve retornar 504 se a requisição exceder o timeout', async () => {
            const res = await request(app).get('/slow');
            expect(res.status).toBe(504);
            expect(res.body.code).toBe('TIMEOUT_ERROR');
        });

        it('deve permitir requisições que terminam antes do timeout', async () => {
            const res = await request(app).get('/fast');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('im fast');
        });
    });

    describe('Circuit Breaker', () => {
        let cb: CircuitBreaker;

        beforeEach(() => {
            vi.clearAllMocks();
            cb = new CircuitBreaker({
                serviceName: 'test-service',
                failureThreshold: 2,
                resetTimeout: 100
            });
        });

        it('deve permitir chamadas quando o estado for CLOSED', async () => {
            mockRedis.get.mockResolvedValue(CircuitState.CLOSED);
            const fn = vi.fn().mockResolvedValue('success');

            const result = await cb.execute(fn);
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('deve abrir o circuito após atingir o limite de falhas', async () => {
            mockRedis.get.mockResolvedValue(CircuitState.CLOSED);
            mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

            const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

            // Primeira falha
            await expect(cb.execute(failingFn)).rejects.toThrow('fail');
            // Segunda falha (atinge threshold)
            await expect(cb.execute(failingFn)).rejects.toThrow('fail');

            expect(mockRedis.set).toHaveBeenCalledWith(expect.stringContaining('state'), CircuitState.OPEN);
        });

        it('deve bloquear chamadas imediatamente quando o circuito estiver OPEN', async () => {
            mockRedis.get.mockResolvedValue(CircuitState.OPEN);
            const fn = vi.fn();

            await expect(cb.execute(fn)).rejects.toThrow(/Circuit Breaker .* is OPEN/);
            expect(fn).not.toHaveBeenCalled();
        });

        it('deve entrar em HALF_OPEN após o tempo de reset', async () => {
            mockRedis.get.mockResolvedValueOnce(CircuitState.OPEN);
            // Simula que o tempo de reset já passou (Date.now() - openTime > 100)
            mockRedis.get.mockResolvedValueOnce((Date.now() - 200).toString());

            const fn = vi.fn().mockResolvedValue('recovered');

            const result = await cb.execute(fn);
            expect(result).toBe('recovered');
            expect(mockRedis.set).toHaveBeenCalledWith(expect.stringContaining('state'), CircuitState.HALF_OPEN);
        });
    });
});

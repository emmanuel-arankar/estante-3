// =============================================================================
// TESTES UNITÁRIOS: LOGGING MIDDLEWARE
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestLogger } from '../middleware/logging.middleware';
import { log } from '../lib/logger';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

vi.mock('../lib/logger', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        metric: vi.fn(),
    },
}));

describe('LoggingMiddleware (requestLogger)', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        req = {
            method: 'POST',
            path: '/api/data',
            ip: '192.168.1.1',
            get: vi.fn().mockReturnValue('Vitest Browser'),
            user: { uid: 'logger_user_1' },
        };

        res = {
            send: vi.fn(),
            statusCode: 200,
        };

        next = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('deve registrar o log de entrada e chamar next()', () => {
        requestLogger(req, res, next);

        expect(log.info).toHaveBeenCalledWith('API Request', expect.objectContaining({
            method: 'POST',
            path: '/api/data',
            userId: 'logger_user_1',
        }));
        expect(next).toHaveBeenCalled();
    });

    it('deve realizar monkey patch no res.send e capturar métricas na saída', () => {
        const originalSend = vi.fn();
        res.send = originalSend;

        requestLogger(req, res, next);

        // Simula passagem de tempo de 150ms
        vi.advanceTimersByTime(150);

        // Executa o send "patchado"
        res.send({ success: true });

        // Verifica se os logs de saída foram chamados
        expect(log.info).toHaveBeenCalledWith('API Response', expect.objectContaining({
            duration: 150,
            statusCode: 200,
        }));

        expect(log.metric).toHaveBeenCalledWith('api_latency_ms', 150, expect.any(Object));

        // Garante que o send original foi chamado
        expect(originalSend).toHaveBeenCalledWith({ success: true });
    });

    it('deve registrar um aviso (warn) se a requisição for lenta (> 2s)', () => {
        res.send = vi.fn();

        requestLogger(req, res, next);

        // Simula lentidão de 2.5s
        vi.advanceTimersByTime(2500);

        res.send('done');

        expect(log.warn).toHaveBeenCalledWith('Slow API Request', expect.objectContaining({
            duration: 2500,
            endpoint: 'POST /api/data',
        }));
    });

    it('deve ser fail-safe: erros no log de entrada não interrompem o fluxo', () => {
        vi.mocked(log.info).mockImplementationOnce(() => {
            throw new Error('Log Failure');
        });

        requestLogger(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('deve ser fail-safe: erros no log de saída não impedem o envio da resposta', () => {
        const originalSend = vi.fn();
        res.send = originalSend;

        requestLogger(req, res, next);

        // Força erro no log de saída
        vi.mocked(log.info).mockImplementation(() => {
            throw new Error('Output Log Failure');
        });

        res.send('data');

        // O send original deve ter sido chamado mesmo com erro no log
        expect(originalSend).toHaveBeenCalledWith('data');
    });
});

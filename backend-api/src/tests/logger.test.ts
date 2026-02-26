// =============================================================================
// TESTES UNITÁRIOS: LOGGER UTIL
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { log } from '../lib/logger';
import * as firebaseLogger from 'firebase-functions/logger';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

vi.mock('firebase-functions/logger', () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));

describe('Logger Utility (lib/logger)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.FUNCTIONS_EMULATOR = 'false';
    });

    it('deve chamar firebaseLogger.info com os dados formatados', () => {
        log.info('Test Info', { userId: '123' });

        expect(firebaseLogger.info).toHaveBeenCalledWith('Test Info', expect.objectContaining({
            userId: '123',
            severity: 'INFO',
            timestamp: expect.any(String),
        }));
    });

    it('deve chamar firebaseLogger.warn com os dados formatados', () => {
        log.warn('Test Warn', { statusCode: 400 });

        expect(firebaseLogger.warn).toHaveBeenCalledWith('Test Warn', expect.objectContaining({
            statusCode: 400,
            severity: 'WARNING',
        }));
    });

    it('deve chamar firebaseLogger.error com stack trace e mensagem', () => {
        const error = new Error('Kaboom');
        log.error('Test Error', error, { endpoint: 'GET /test' });

        expect(firebaseLogger.error).toHaveBeenCalledWith('Test Error', expect.objectContaining({
            severity: 'ERROR',
            error: expect.objectContaining({
                message: 'Kaboom',
                stack: expect.any(String),
            }),
        }));
    });

    it('deve registrar métricas usando firebaseLogger.info', () => {
        log.metric('api_latency', 150, { method: 'POST' });

        expect(firebaseLogger.info).toHaveBeenCalledWith('METRICA: api_latency', expect.objectContaining({
            metricName: 'api_latency',
            metricValue: 150,
            labels: expect.objectContaining({ type: 'metric' }),
        }));
    });

    describe('debug', () => {
        it('NÃO deve chamar firebaseLogger.debug se FUNCTIONS_EMULATOR for false', () => {
            log.debug('Invisible msg');
            expect(firebaseLogger.debug).not.toHaveBeenCalled();
        });

        it('deve chamar firebaseLogger.debug se FUNCTIONS_EMULATOR for true', () => {
            process.env.FUNCTIONS_EMULATOR = 'true';
            log.debug('Visible msg', { debugVal: 1 });

            expect(firebaseLogger.debug).toHaveBeenCalledWith('Visible msg', expect.objectContaining({
                severity: 'DEBUG',
                debugVal: 1,
            }));
        });
    });
});

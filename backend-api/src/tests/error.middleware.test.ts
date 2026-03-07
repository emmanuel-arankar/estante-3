// =============================================================================
// TESTES UNITÁRIOS: ERROR MIDDLEWARE
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler } from '../middleware/error.middleware';
import { ZodError } from 'zod';
import { log } from '../lib/logger';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

vi.mock('../lib/logger', () => ({
    log: {
        error: vi.fn(),
    },
}));

vi.mock('../lib/i18n', () => ({
    t: vi.fn((key: string) => {
        const translations: Record<string, string> = {
            'common.validationError': 'Dados inválidos na requisição',
            'common.internalError': 'Erro interno do servidor',
        };
        return translations[key] || key;
    }),
}));

describe('ErrorMiddleware (errorHandler)', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        vi.clearAllMocks();

        req = {
            method: 'GET',
            path: '/api/error-test',
            ip: '127.0.0.1',
            get: vi.fn().mockReturnValue('Vitest Agent'),
            user: undefined,
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        // Reset env
        process.env.FUNCTIONS_EMULATOR = 'false';
    });

    // =============================================================================
    // TESTES: Normalização de Erros Comuns
    // =============================================================================

    it('deve tratar erro genérico como 500 INTERNAL_ERROR', () => {
        const error = new Error('Erro inesperado');

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            error: 'Erro inesperado',
            code: 'INTERNAL_ERROR',
            details: undefined,
        });
        expect(log.error).toHaveBeenCalled();
    });

    it('deve respeitar statusCode e code personalizados no objeto de erro', () => {
        const error: any = new Error('Não encontrado');
        error.statusCode = 404;
        error.code = 'USER_NOT_FOUND';

        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            error: 'Não encontrado',
            code: 'USER_NOT_FOUND',
            details: undefined,
        });
    });

    // =============================================================================
    // TESTES: Erros de Validação (Zod)
    // =============================================================================

    it('deve retornar 400 e detalhes flat para ZodError', () => {
        // Criamos um erro sintético do Zod
        const zodError = new ZodError([
            {
                code: 'invalid_type',
                expected: 'string',
                path: ['email'],
                message: 'Email deve ser string',
            },
        ]);

        errorHandler(zodError, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Dados inválidos na requisição',
            details: expect.any(Object),
        }));

        // Verifica log do erro de validação (ZodError tem statusCode default no middleware 500, 
        // mas a resposta pro cliente é 400)
        expect(log.error).toHaveBeenCalledWith('API Error', zodError, expect.any(Object));
    });

    // =============================================================================
    // TESTES: Contexto e Segurança
    // =============================================================================

    it('deve incluir UID no log se o usuário estiver autenticado', () => {
        req.user = { uid: 'user_error_123' };
        const error = new Error('Erro logado');

        errorHandler(error, req, res, next);

        expect(log.error).toHaveBeenCalledWith(
            'API Error',
            error,
            expect.objectContaining({ userId: 'user_error_123' })
        );
    });

    it('deve incluir stack trace nos detalhes APENAS no emulador', () => {
        process.env.FUNCTIONS_EMULATOR = 'true';
        const error = new Error('Erro com stack');

        errorHandler(error, req, res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            details: expect.stringContaining('Error: Erro com stack'),
        }));
    });
});

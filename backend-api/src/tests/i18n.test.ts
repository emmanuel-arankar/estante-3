import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { i18nMiddleware } from '../middleware/i18n.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { t } from '../lib/i18n';

// Mock do logger para evitar poluição no console durante testes
vi.mock('../lib/logger', () => ({
    log: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('Internacionalização (i18n)', () => {

    describe('Utilitário t()', () => {
        it('deve traduzir uma chave para pt-BR por padrão', () => {
            expect(t('common.internalError')).toBe('Ocorreu um erro interno no servidor.');
        });

        it('deve traduzir uma chave para en-US', () => {
            expect(t('common.internalError', 'en-US')).toBe('An internal server error occurred.');
        });

        it('deve retornar a chave se não encontrar tradução', () => {
            expect(t('non.existent.key')).toBe('non.existent.key');
        });
    });

    describe('Middleware i18n e Error Handler', () => {
        const app = express();
        app.use(i18nMiddleware);

        app.get('/error', (req, res, next) => {
            // Força um erro sem mensagem para testar a tradução padrão
            next(new Error());
        });

        app.use(errorHandler);

        it('deve detectar pt-BR via header Accept-Language', async () => {
            const res = await request(app)
                .get('/error')
                .set('Accept-Language', 'pt-BR');

            expect(res.body.error).toBe('Ocorreu um erro interno no servidor.');
        });

        it('deve detectar en-US via header Accept-Language', async () => {
            const res = await request(app)
                .get('/error')
                .set('Accept-Language', 'en-US');

            expect(res.body.error).toBe('An internal server error occurred.');
        });

        it('deve usar pt-BR como fallback se o idioma não for suportado', async () => {
            const res = await request(app)
                .get('/error')
                .set('Accept-Language', 'fr-FR');

            expect(res.body.error).toBe('Ocorreu um erro interno no servidor.');
        });
    });
});

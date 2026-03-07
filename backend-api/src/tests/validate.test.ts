import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';
import { requestIdMiddleware } from '../middleware/requestId.middleware';
import { responseWrapper } from '../middleware/response.middleware';

describe('Middleware de Validação (validate.middleware)', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(requestIdMiddleware);
    testApp.use(responseWrapper);

    const bodySchema = z.object({
        name: z.string().min(3),
    });
    const querySchema = z.object({
        id: z.string().regex(/^\d+$/),
    });

    testApp.post('/test-val', validate({ body: bodySchema, query: querySchema }), (req, res) => {
        res.json({ success: true, data: { body: req.body, query: req.query } });
    });

    const transformSchema = z.object({
        age: z.coerce.number().min(18),
        username: z.string().trim().toLowerCase().min(3),
    });

    testApp.post('/test-transform', validate({ body: transformSchema }), (req, res) => {
        res.json({ success: true, data: req.body });
    });

    it('deve validar body e query corretamente', async () => {
        const res = await request(testApp)
            .post('/test-val?id=123')
            .send({ name: 'Valid Name' });

        expect(res.status).toBe(200);
        expect(res.body.data.data.body.name).toBe('Valid Name');
        expect(res.body.data.data.query.id).toBe('123');
    });

    it('deve transformar e normalizar dados corretamente', async () => {
        const res = await request(testApp)
            .post('/test-transform')
            .send({
                age: '25',
                username: '  UserNAME  '
            });

        expect(res.status).toBe(200);
        expect(res.body.data.data.age).toBe(25);
        expect(res.body.data.data.username).toBe('username');
    });

    it('deve retornar 400 para body inválido', async () => {
        const res = await request(testApp)
            .post('/test-val?id=123')
            .send({ name: 'ab' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Dados inválidos');
        expect(res.body.details.name).toBeDefined();
    });

    it('deve retornar 400 para query inválida', async () => {
        const res = await request(testApp)
            .post('/test-val?id=abc')
            .send({ name: 'Valid Name' });

        expect(res.status).toBe(400);
        expect(res.body.details.id).toBeDefined();
    });
});

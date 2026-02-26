import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { compressionMiddleware } from '../middleware/compression.middleware';
import zlib from 'zlib';

describe('Compression Middleware', () => {
    const app = express();

    // Configura o middleware com um threshold baixo (100 bytes) para facilitar os testes
    app.use(compressionMiddleware(100));

    app.get('/small', (req, res) => {
        res.send('Pequeno');
    });

    app.get('/large', (req, res) => {
        // Envia um corpo maior que 100 bytes
        res.send('A'.repeat(200));
    });

    app.get('/json', (req, res) => {
        res.json({ message: 'A'.repeat(200) });
    });

    it('não deve comprimir respostas menores que o threshold', async () => {
        const res = await request(app)
            .get('/small')
            .set('Accept-Encoding', 'gzip');

        expect(res.headers['content-encoding']).toBeUndefined();
        expect(res.text).toBe('Pequeno');
    });

    it('deve comprimir respostas maiores que o threshold se o cliente suportar gzip', async () => {
        const server = app.listen(0);
        const port = (server.address() as any).port;

        const dataArr: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
            const req = http.get(`http://localhost:${port}/large`, {
                headers: { 'Accept-Encoding': 'gzip' }
            }, (res) => {
                expect(res.headers['content-encoding']).toBe('gzip');
                res.on('data', (chunk: Buffer) => dataArr.push(chunk));
                res.on('end', () => resolve());
                res.on('error', reject);
            });
            req.on('error', reject);
        });

        server.close();
        const fullBody = Buffer.concat(dataArr);

        // Verifica se é gzip válido (começa com 1f 8b)
        expect(fullBody[0]).toBe(0x1f);
        expect(fullBody[1]).toBe(0x8b);

        const decompressed = zlib.gunzipSync(fullBody).toString();
        expect(decompressed).toBe('A'.repeat(200));
    });

    it('não deve comprimir se o cliente não enviar Accept-Encoding: gzip', async () => {
        const res = await request(app)
            .get('/large')
            .set('Accept-Encoding', 'identity'); // 'identity' explicitamente diz "sem compressão"

        expect(res.headers['content-encoding']).toBeUndefined();
        expect(res.text).toBe('A'.repeat(200));
    });

    it('deve comprimir respostas JSON corretamente', async () => {
        const server = app.listen(0);
        const port = (server.address() as any).port;

        const dataArr: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
            http.get(`http://localhost:${port}/json`, {
                headers: { 'Accept-Encoding': 'gzip' }
            }, (res: http.IncomingMessage) => {
                expect(res.headers['content-encoding']).toBe('gzip');
                res.on('data', (chunk: Buffer) => dataArr.push(chunk));
                res.on('end', resolve);
            }).on('error', reject);
        });

        server.close();
        const fullBody = Buffer.concat(dataArr);
        const decompressed = zlib.gunzipSync(fullBody).toString();
        const json = JSON.parse(decompressed);
        expect(json.message).toBe('A'.repeat(200));
    });
});

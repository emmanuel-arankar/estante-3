import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import * as logger from 'firebase-functions/logger';

/**
 * @name Middleware de Compressão (Manual)
 * @summary Comprime respostas JSON e texto usando Gzip.
 * @description Intercepta a resposta e comprime o corpo se for maior que o limite definido (1KB),
 * economizando largura de banda e melhorando a performance para o usuário final.
 * 
 * @param {number} threshold - Tamanho mínimo em bytes para comprimir (padrão: 1024).
 */
export const compressionMiddleware = (threshold = 1024) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // 0. Evitar compressão dupla se já estiver definido
        if (res.getHeader('Content-Encoding')) {
            return next();
        }

        // 1. Verificar se o cliente aceita gzip
        const acceptEncoding = req.headers['accept-encoding'] || '';

        // Log para depuração em testes
        if (process.env.NODE_ENV === 'test') {
            // logger.debug(`Accept-Encoding: ${acceptEncoding}`);
        }

        if (!acceptEncoding.includes('gzip')) {
            return next();
        }

        // Acumulador para o corpo da resposta
        let chunks: Buffer[] = [];
        const originalEnd = res.end;

        // Interceptar res.write
        res.write = function (this: any, chunk: any, encoding?: any, callback?: any): boolean {
            if (chunk) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
                chunks.push(buffer);
            }
            return true; // Mentimos dizendo que escrevemos, mas estamos acumulando
        } as any;

        // Interceptar res.end
        res.end = function (this: any, chunk: any, encoding?: any, callback?: any): Response {
            if (chunk) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
                chunks.push(buffer);
            }

            const body = Buffer.concat(chunks);
            chunks = []; // Limpa para evitar leaks

            // Se o corpo for menor que o threshold, envia original
            if (body.length < threshold) {
                return originalEnd.call(this, body, encoding as any, callback);
            }

            try {
                const compressed = zlib.gzipSync(body);

                if (process.env.NODE_ENV === 'test') {
                    console.log(`[Middleware] Comprimindo: ${body.length} -> ${compressed.length} bytes`);
                }

                // Configurar cabeçalhos
                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Vary', 'Accept-Encoding');
                res.setHeader('Content-Length', compressed.length);

                // Enviar os dados comprimidos diretamente no end
                return originalEnd.call(this, compressed, encoding as any, callback);
            } catch (err) {
                logger.error('Erro ao comprimir:', err);
                return originalEnd.call(this, body, encoding as any, callback);
            }
        } as any;

        next();
    };
};

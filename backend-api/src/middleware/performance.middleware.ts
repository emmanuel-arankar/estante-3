import { Request, Response, NextFunction } from 'express';
import * as logger from 'firebase-functions/logger';

/**
 * @name Detector de Requisições Lentas
 * @summary Middleware para monitoramento de latência.
 * @description Intercepta a requisição e calcula o tempo total de processamento.
 * Se o tempo exceder o limite definido (threshold), registra um aviso no log.
 * 
 * @param {number} threshold - Limite em milissegundos (default: 1000ms)
 * @returns {Function} Middleware Express
 */
export const performanceMiddleware = (threshold: number = 1000) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = process.hrtime();

        // Escuta o evento 'finish' que ocorre quando a resposta é enviada
        res.on('finish', () => {
            const diff = process.hrtime(start);
            const durationInMs = (diff[0] * 1e3 + diff[1] * 1e-6);

            // Se a requisição for lenta ou se for um timeout, logamos com severidade WARNING
            if (durationInMs > threshold || res.statusCode === 504) {
                const isTimeout = res.statusCode === 504;
                const message = isTimeout ? 'Request Timeout Detected' : 'Slow Request Detected';

                logger.warn(message, {
                    method: req.method,
                    path: req.path,
                    durationMs: Math.round(durationInMs),
                    thresholdMs: threshold,
                    status: res.statusCode,
                    requestId: req.get('X-Request-Id') || (req as any).requestId,
                    userId: (req as any).user?.uid
                });
            }
        });

        next();
    };
};

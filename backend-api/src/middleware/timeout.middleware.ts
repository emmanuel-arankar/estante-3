import { Request, Response, NextFunction } from 'express';
import * as logger from 'firebase-functions/logger';

/**
 * @name Middleware de Timeout
 * @summary Interrompe requisições lentas.
 * @description Garante que uma requisição não fique aberta por mais tempo que o permitido.
 * Se o tempo limite for atingido, a requisição é encerrada com erro 504.
 * 
 * @param {number} ms - Tempo limite em milissegundos (default: 30000ms - 30s)
 * @returns {Function} Middleware Express
 */
export const timeoutMiddleware = (ms: number = 30000) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Configura um temporizador para o timeout
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn('Request Timeout Reached', {
                    method: req.method,
                    path: req.path,
                    timeoutMs: ms,
                    requestId: (req as any).requestId,
                    userId: (req as any).user?.uid
                });

                res.status(504).json({
                    error: 'Tempo de resposta excedido (Gateway Timeout)',
                    code: 'TIMEOUT_ERROR',
                    requestId: (req as any).requestId
                });
            }
        }, ms);

        // Quando a requisição termina (com sucesso ou erro rápido), limpa o temporizador
        res.on('finish', () => clearTimeout(timer));
        res.on('close', () => clearTimeout(timer));

        next();
    };
};

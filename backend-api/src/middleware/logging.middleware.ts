import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';

export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email?: string;
    };
}

/**
 * Middleware para logar todas as requisições e respostas
 * 
 * Registra:
 * - Request: método, path, userId, IP, user-agent
 * - Response: status code, duration
 * - Métrica: latência da API
 */
export const requestLogger = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    const startTime = Date.now();
    const { method, path, ip } = req;
    const userId = req.user?.uid;

    // Log da requisição recebida
    log.info('API Request', {
        method,
        path,
        userId,
        ip,
        userAgent: req.get('user-agent'),
    });

    // Interceptar o response para logar quando a requisição completar
    const originalSend = res.send;

    res.send = function (data) {
        const duration = Date.now() - startTime;
        const { statusCode } = res;
        const endpoint = `${method} ${path}`;

        // Log da resposta
        log.info('API Response', {
            method,
            path,
            userId,
            statusCode,
            duration,
            endpoint,
        });

        // Métrica de latência
        log.metric('api_latency_ms', duration, {
            endpoint,
            statusCode,
            method,
        });

        // Alerta para requests muito lentas (> 2s)
        if (duration > 2000) {
            log.warn('Slow API Request', {
                endpoint,
                duration,
                userId,
                statusCode,
            });
        }

        return originalSend.call(this, data);
    };

    next();
};

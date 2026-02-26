import { RequestHandler } from 'express';
import { randomUUID } from 'crypto';

/**
 * @name Middleware de ID de Requisição
 * @summary Injeta um identificador único em cada requisição.
 * @description Gera um UUID v4 e o anexa ao cabeçalho `X-Request-Id` da resposta
 * e ao objeto `req` para rastreabilidade em logs.
 * 
 * @returns {RequestHandler} Middleware Express
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
    // Gerar ID ou usar o que já veio (se houver proxy/load balancer)
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Injetar na requisição para uso posterior
    (req as any).requestId = requestId;

    // Retornar no cabeçalho da resposta
    res.setHeader('X-Request-Id', requestId);

    return next();
};

import { RequestHandler } from 'express';

/**
 * @name Middleware de Padronização de Respostas
 * @summary Garante que todas as saídas da API sigam o mesmo contrato JSON.
 * @description Intercepta o método res.json para injetar metadados como 
 * requestId (do middleware anterior) e status da requisição.
 * 
 * @returns {RequestHandler} Middleware Express
 */
export const responseWrapper: RequestHandler = (req, res, next) => {
    // Salva a referência original do res.json
    const originalJson = res.json;

    // Sobrescreve o res.json
    res.json = function (this: any, body: any) {
        // Se a resposta já parecer estar formatada, ou for um erro cru, evitamos loop
        const isStandard = body && typeof body === 'object' && ('status' in body && 'requestId' in body);

        if (isStandard) {
            return originalJson.call(this, body);
        }

        // Determina o status baseado no código HTTP
        const isError = res.statusCode >= 400;

        const standardResponse = {
            status: isError ? 'error' : 'success',
            requestId: (req as any).requestId || 'unknown',
            data: isError ? undefined : body,
            error: isError ? body : undefined,
            meta: {
                timestamp: new Date().toISOString(),
                path: req.originalUrl,
                method: req.method,
                locale: (req as any).locale
            }
        };

        // Chama o json original com o corpo formatado
        return originalJson.call(this, standardResponse);
    } as any;

    return next();
};

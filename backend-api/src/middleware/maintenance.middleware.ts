import { RequestHandler } from 'express';
import * as logger from 'firebase-functions/logger';

/**
 * @name Middleware de Modo Manutenção
 * @summary Bloqueia operações de escrita se o modo manutenção estiver ativo.
 * @description Verifica a variável de ambiente `MAINTENANCE_MODE`.
 * Se presente, bloqueia POST, PUT, PATCH e DELETE.
 * 
 * @returns {RequestHandler} Middleware Express
 */
export const maintenanceMiddleware: RequestHandler = (req, res, next) => {
    const isMaintenance = process.env.MAINTENANCE_MODE === 'true';

    // Se não estiver em manutenção, segue o jogo
    if (!isMaintenance) {
        return next();
    }

    // Métodos de somente leitura são permitidos mesmo em manutenção
    const readMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (readMethods.includes(req.method)) {
        return next();
    }

    // Bloquear métodos de mutação
    logger.warn('Tentativa de escrita bloqueada: Modo Manutenção Ativo', {
        method: req.method,
        path: req.path,
        requestId: (req as any).requestId
    });

    return res.status(503).json({
        error: 'Servidor em manutenção',
        message: 'Estamos realizando melhorias programadas. No momento o sistema está em modo somente leitura.',
        retryAfter: '3600' // Sugestão de 1 hora em segundos
    });
};

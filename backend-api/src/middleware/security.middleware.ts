import rateLimit from 'express-rate-limit';
import * as logger from 'firebase-functions/logger';

/**
 * @name Handler de Excesso de Limite
 * @summary Log e resposta padronizada para 429.
 */
const limitHandler = (message: string) => (req: any, res: any, next: any, options: any) => {
    logger.warn('Rate limit excedido', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        limit: options.max,
    });
    res.status(options.statusCode).send({ error: message });
};

/**
 * @name Limite de Autenticação
 * @summary Proteção contra Brute Force em Login/Registro.
 * @description Limita a 5 tentativas a cada 15 minutos por IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Um pouco mais permissivo para desenvolvimento, mas rígido o suficiente.
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler('Muitas tentativas de autenticação. Tente novamente em 15 minutos.')
});

/**
 * @name Limite de Interação Social
 * @summary Evita spam de mensagens e reações.
 * @description Limita a 60 requisições por minuto (1 por segundo em média).
 */
export const socialLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler('Você está enviando interações muito rápido. Desacelere um pouco.')
});

/**
 * @name Limite de Busca
 * @summary Proteção para o motor de busca.
 */
export const searchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: limitHandler('Muitas buscas realizadas. Aguarde um momento.')
});

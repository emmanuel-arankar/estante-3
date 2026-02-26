import { Request, Response, NextFunction } from 'express';

/**
 * @name Middleware de Cache-Control Inteligente
 * @description Define políticas de cache HTTP baseadas na rota e no método da requisição.
 * Garante que dados sensíveis não sejam cacheados e permite cache para recursos públicos.
 */
export const cacheControlMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const { method, path } = req;

    // 1. Mutações e requisições não-GET nunca devem ser cacheadas
    if (method !== 'GET') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return next();
    }

    // 2. Rotas Públicas/Semi-estáticas (Ex: Health Check, Availability Check)
    const publicRoutes = ['/api/health', '/health'];
    if (publicRoutes.includes(path)) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // Cache de 5 minutos
        return next();
    }

    // 3. Padrão para Dados Privados/Dinâmicos (Amizades, Chat, Perfil)
    // Usamos no-store para garantir que dados sensíveis nunca fiquem em caches intermediários (proxies, navegadores)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
};

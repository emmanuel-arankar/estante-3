import { Request, Response, NextFunction } from 'express';

/**
 * @name Middleware de Headers de Segurança
 * @description Aplica manualmente cabeçalhos HTTP para fortalecer a segurança da API seguindo as práticas da OWASP.
 * 
 * @param {Request} _req - Objeto da requisição Express (não utilizado).
 * @param {Response} res - Objeto da resposta Express.
 * @param {NextFunction} next - Função para passar o controle para o próximo middleware.
 */
export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
    // 1. Impedir que a API seja carregada em frames (Proteção contra Clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');

    // 2. Impedir que o navegador tente adivinhar o Content-Type (Segurança de MIME)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 3. Forçar HTTPS por 2 anos (HSTS)
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

    // 4. Content Security Policy (Restritivo para APIs)
    // - default-src 'self': Permite recursos da mesma origem.
    // - frame-ancestors 'none': Impede que a API seja incorporada em frames de terceiros.
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';");

    // 5. Controlar informações de Referer
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 6. Restringir acesso a APIs do Navegador (Privacidade e Segurança)
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

    // 7. Desativar filtro legados de XSS (CSP é o padrão moderno)
    res.setHeader('X-XSS-Protection', '0');

    // 8. Remover header informativo do Express (Evita fingerprinting básico)
    res.removeHeader('X-Powered-By');

    next();
};

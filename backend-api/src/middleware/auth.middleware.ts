// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// ==== ==== INTERFACES E TIPOS ==== ====

/**
 * @name Interface de Requisição Autenticada
 * @summary Extensão do Request com dados do usuário.
 * @description Estende a interface {@link Request} do Express para incluir 
 * a propriedade 'user' (que virá do token decodificado do Firebase).
 * 
 * @property {admin.auth.DecodedIdToken} user - Dados do token decodificado pelo Firebase Admin SDK
 */
export interface AuthenticatedRequest extends Request {
  user: admin.auth.DecodedIdToken;
}

// ==== ==== MIDDLEWARE DE AUTENTICAÇÃO ==== ====

/**
 * @name Verificar Autenticação
 * @summary Middleware de proteção de rotas.
 * @description Middleware para verificar o cookie de sessão ou o Token ID do Firebase.
 * Se for válido, anexa os dados do usuário a `req.user`.
 * Prioriza o cookie `__session` e faz fallback para o cabeçalho `Authorization: Bearer`.
 * 
 * @params {Request} req - Objeto de requisição {@link Request} do Express
 * @params {Response} res - Objeto de resposta {@link Response} do Express
 * @params {NextFunction} next - Função de continuidade {@link NextFunction}
 * @throws {UnauthorizedError} Retorna 401 se nenhum método de autenticação for válido.
 * @example
 * app.get('/perfil', checkAuth, (req, res) => { ... });
 */
export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  const sessionCookie = req.cookies?.__session || '';

  // 1. Tentar validar via Cookie de Sessão (Prioridade para Navegadores/SSR)
  // [DECISÃO] Cookies são preferíveis para aplicações web por serem HttpOnly e resilientes a XSS.
  if (sessionCookie) {
    try {
      // [SEGURANÇA] Verifica se o token foi revogado manualmente no console do Firebase
      const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
      (req as AuthenticatedRequest).user = decodedToken;
      return next();
    } catch (error: any) {
      if (error.code === 'auth/session-cookie-revoked') {
        return res.status(401).send({ error: 'Sua sessão foi revogada. Faça login novamente.' });
      }
      // [FALLBACK] Se a validação do cookie falhar, não rejeitamos imediatamente; tentamos o Header Authorization.
      // Isso permite que clientes híbridos (App + Web) funcionem de forma transparente.
      logger.warn('Cookie de sessão inválido, tentando cabeçalho Auth', { error: error.message });
    }
  }

  // 2. Tentar validar via ID Token (Header Authorization)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as AuthenticatedRequest).user = decodedToken;
      return next();
    } catch (error: any) {
      logger.warn('ID Token inválido', { error: error.message });
      return res.status(401).send({ error: 'Token de autenticação inválido ou expirado.' });
    }
  }

  // Se nenhum dos métodos de autenticação funcionar
  if (!sessionCookie && !authHeader) {
    logger.warn('Acesso não autenticado (sem cookie ou header)', { path: req.path });
    return res.status(401).send({ error: 'Não autenticado. Faça login.' });
  }

  // Fallback: caso o cookie exista mas seja inválido e não haja um Header Authorization válido
  return res.status(401).send({ error: 'Sessão inválida. Faça login novamente.' });
};

/**
 * @name Verificar Autenticação Opcional
 * @summary Middleware que tenta identificar o usuário mas não bloqueia se não houver.
 * @description Similar ao checkAuth, mas chama next() mesmo se o token for inválido ou ausente.
 * Útil para rotas públicas que mudam o comportamento se o usuário estiver logado (ex: isLiked).
 */
export const checkAuthOptional = async (req: Request, _res: Response, next: NextFunction) => {
  const sessionCookie = req.cookies?.__session || '';
  const authHeader = req.headers.authorization;

  if (sessionCookie) {
    try {
      const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, false);
      (req as AuthenticatedRequest).user = decodedToken;
      return next();
    } catch { /* Ignora erro e segue */ }
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as AuthenticatedRequest).user = decodedToken;
      return next();
    } catch { /* Ignora erro e segue */ }
  }

  next();
};
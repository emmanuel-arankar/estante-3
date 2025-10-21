import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

/**
 * Estende a interface Request do Express para incluir 
 * nossa propriedade 'user' (que virá do token decodificado).
 */
export interface AuthenticatedRequest extends Request {
  user: admin.auth.DecodedIdToken;
}

/**
 * Middleware para verificar o cookie de sessão do Firebase.
 * Se for válido, anexa os dados do usuário a `req.user`.
 * Se for inválido, retorna um erro 401.
 */
export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Pega o cookie de sessão do objeto 'req.cookies'
  const sessionCookie = req.cookies?.__session || '';

  if (!sessionCookie) {
    logger.warn('Tentativa de acesso não autenticado (cookie ausente)', { path: req.path, ip: req.ip });
    // Se não houver cookie, o usuário não está logado.
    return res.status(401).send({ error: 'Não autenticado. Cookie de sessão ausente.' });
  }

  try {
    // Verifica o cookie com o Firebase Admin.
    // O 'true' verifica se a sessão foi revogada (ex: mudança de senha).
    const decodedToken = await admin.auth().verifySessionCookie(
      sessionCookie,
      true // checkRevoked
    );

    // Anexa os dados do usuário (payload do token) à requisição.
    // Usamos um cast para nossa interface customizada.
    (req as AuthenticatedRequest).user = decodedToken;
    // Logar sucesso (opcional, pode ser verboso)
    // logger.debug('Cookie de sessão verificado com sucesso', { uid: decodedToken.uid, path: req.path });
    return next();
  } catch (error: any) {
    logger.warn('Falha ao verificar cookie de sessão:', {
        errorCode: error.code,
        errorMessage: error.message,
        path: req.path,
        ip: req.ip
    });
    // Determinar a mensagem de erro específica baseada no código
    let clientErrorMessage = 'Sessão inválida ou expirada. Faça login novamente.';
    if (error.code === 'auth/session-cookie-revoked') {
      clientErrorMessage = 'Sua sessão foi revogada (ex: mudança de senha). Faça login novamente.';
    }

    return res.status(401).send({ error: clientErrorMessage });
  }
};
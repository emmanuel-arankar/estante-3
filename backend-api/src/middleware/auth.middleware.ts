import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

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

    // Continua para a próxima função (o handler da rota principal)
    return next();

  } catch (error) {
    // O cookie é inválido, expirado ou foi revogado.
    console.warn('Falha ao verificar cookie de sessão:', error);
    return res.status(401).send({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
};
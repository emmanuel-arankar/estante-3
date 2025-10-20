import { Router } from 'express';
import * as admin from 'firebase-admin';
import { FirebaseError } from 'firebase-admin/app';
import * as logger from 'firebase-functions/logger';
import { sessionLoginBodySchema } from './schemas/auth.schema';

const router = Router();

const QUATORZE_DIAS_EM_MS = 60 * 60 * 24 * 14 * 1000;
/**
 * Cria um cookie de sessão a partir de um ID token do Firebase.
 */
router.post('/sessionLogin', async (req, res) => {
  // # atualizado: Validar req.body usando o schema
  const validationResult = sessionLoginBodySchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Dados de login inválidos',
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { idToken } = validationResult.data;

  const expiresIn = QUATORZE_DIAS_EM_MS;

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    const isProd = process.env.FUNCTIONS_EMULATOR !== 'true';
    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const // Considere adicionar para proteção CSRF adicional
    };

    res.cookie('__session', sessionCookie, options);
    logger.info('Cookie de sessão criado com sucesso.');
    return res.status(200).send({ status: 'success' });
  } catch (error: any) {
    // # atualizado: Usar logger.error para logs estruturados
    logger.error('Erro ao criar cookie de sessão:', error);

    const firebaseError = error as FirebaseError;
    let statusCode = 500;
    let errorMessage = 'Falha interna ao processar autenticação.';

    switch (firebaseError.code) {
      case 'auth/user-not-found':
        statusCode = 401;
        errorMessage = 'Usuário não encontrado. Por favor, faça login novamente.';
        break;
      case 'auth/invalid-id-token':
      case 'auth/argument-error': // Trata token malformado também
        statusCode = 401;
        errorMessage = 'Token inválido. Faça login novamente.';
        break;
      case 'auth/id-token-expired':
        statusCode = 401;
        errorMessage = 'Sua sessão expirou. Faça login novamente.';
        break;
      case 'auth/id-token-revoked':
        statusCode = 401;
        errorMessage = 'Sua sessão foi invalidada. Faça login novamente.';
        break;
      // Adicione outros casos específicos se encontrar necessidade
      // case 'auth/internal-error': // Pode deixar cair no default 500
      //   break;
      default:
        // Mantém 500 e a mensagem genérica para erros não esperados
        break;
    }

    return res.status(statusCode).send({ error: errorMessage });
  }
});

/**
 * Limpa o cookie de sessão para fazer logout.
 */
router.post('/sessionLogout', (req, res) => {
  // Esta rota não recebe dados, então não precisa de validação Zod
  res.clearCookie('__session');
  logger.info('Cookie de sessão limpo (logout).');
  return res.status(200).send({ status: 'success' });
});

export default router;
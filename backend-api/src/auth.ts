import { Router } from 'express';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { FirebaseError } from 'firebase-admin/app';
import { sessionLoginBodySchema } from './schemas/auth.schema';

const router = Router();

const SESSION_COOKIE_DURATION_MS = parseInt(process.env.SESSION_COOKIE_DURATION_MS || '', 10) || 14 * 24 * 60 * 60 * 1000;
logger.info(`Usando duração do cookie de sessão: ${SESSION_COOKIE_DURATION_MS} ms`);

/**
 * Cria um cookie de sessão a partir de um ID token do Firebase.
 */
router.post('/sessionLogin', async (req, res, next) => {
  // Valida req.body usando o schema
  const validationResult = sessionLoginBodySchema.safeParse(req.body);

  if (!validationResult.success) {
    logger.warn('Falha na validação do login de sessão', {
      errors: validationResult.error.flatten().fieldErrors,
      body: req.body // Cuidado ao logar bodies em produção se contiverem dados sensíveis não criptografados
    });
    return res.status(400).json({
      error: 'Dados de login inválidos',
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { idToken } = validationResult.data;
  const expiresIn = SESSION_COOKIE_DURATION_MS;

  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    const isProd = process.env.FUNCTIONS_EMULATOR !== 'true';
    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const
    };

    res.cookie('__session', sessionCookie, options);
    logger.info('Cookie de sessão criado com sucesso.');
    return res.status(200).send({ status: 'success' });
  } catch (error: any) {
    logger.error('Erro ao criar cookie de sessão:', {
      errorMessage: error.message,
      errorCode: error.code,
      // Evite logar o idToken inteiro por segurança
    });

    const firebaseError = error as FirebaseError;
    let statusCode = 401; // Assume 401 para erros Firebase Auth por padrão aqui
    let errorMessage = 'Falha na autenticação. Faça login novamente.';
    let shouldLogError = true; // Controla se logamos como erro ou aviso

    switch (firebaseError.code) {
      // Casos que são erros do cliente ou esperados (401), logamos como aviso
      case 'auth/user-not-found':
        errorMessage = 'Usuário não encontrado. Por favor, faça login novamente.';
        shouldLogError = false;
        break;
      case 'auth/invalid-id-token':
      case 'auth/argument-error':
        errorMessage = 'Token inválido. Faça login novamente.';
        shouldLogError = false;
        break;
      case 'auth/id-token-expired':
        errorMessage = 'Sua sessão expirou. Faça login novamente.';
        shouldLogError = false;
        break;
      case 'auth/id-token-revoked':
        errorMessage = 'Sua sessão foi invalidada. Faça login novamente.';
        shouldLogError = false;
        break;
      // Adicione outros casos específicos se encontrar necessidade
      // case 'auth/internal-error': // Pode deixar cair no default 500
      //   break;
      // Caso seja um erro inesperado do Firebase, deixe passar para o handler central (500)
      default:
        // Passa o erro inesperado para o handler central
        return next(error); // Isso vai acionar o errorHandler
    }

    // Loga como aviso se for erro esperado do cliente
    if (!shouldLogError) {
      logger.warn('Falha ao criar cookie de sessão (erro esperado):', {
        errorCode: firebaseError.code,
        errorMessage: firebaseError.message,
      });
    }

    // Retorna o erro específico (401)
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
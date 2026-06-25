// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response, RequestHandler } from 'express';
import { admin, auth, db } from './firebase';
import { FirebaseError } from 'firebase-admin/app';
import * as logger from 'firebase-functions/logger';
import {
  sessionLoginBodySchema,
  registerSchema,
  loginSchema,
  recoverSchema,
  googleAuthSchema
} from './schemas/auth.schema';
import { validate } from './middleware/validate.middleware';
import { authLimiter } from './middleware/security.middleware';
import { AuditService } from './services/audit.service';
import { generateSearchTerms } from './lib/search';

const router = Router();

/**
 * @name Gerar Unique Nickname
 * @summary Cria um nickname único baseado no display name.
 * @description Verifica a disponibilidade do nickname na coleção `nicknames` e incrementa um sufixo numérico se necessário.
 */
async function generateUniqueNickname(transaction: admin.firestore.Transaction, displayName: string): Promise<string> {
  const baseNickname = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) || 'user';
  let nickname = baseNickname;
  let counter = 1;

  while (true) {
    const nicknameRef = db.collection('nicknames').doc(nickname);
    const nicknameDoc = await transaction.get(nicknameRef);
    if (!nicknameDoc.exists) return nickname;
    nickname = `${baseNickname}${counter}`;
    counter++;
  }
}

/**
 * @name Obter Firebase API Key
 * @summary Recupera a chave de API do ambiente.
 */
function getFirebaseApiKey(): string | undefined {
  return process.env.VITE_FIREBASE_API_KEY;
}

// =============================================================================
// ROTAS DE AUTENTICAÇÃO
// =============================================================================

/**
 * @name Session Login
 * @summary Cria um cookie de sessão a partir de um ID Token.
 * @description Recebe o ID Token do frontend, valida-o e gera um cookie de sessão seguro (httpOnly).
 * 
 * @route {POST} /api/auth/sessionLogin
 * @bodyparams {string} idToken - Token gerado pelo Firebase Auth no cliente.
 * @bodyparams {boolean} [rememberMe] - Se verdadeiro, estende a validade do cookie.
 * @returns {Object} 200 - { status: 'success' }
 */
router.post('/sessionLogin', authLimiter as unknown as RequestHandler, validate({ body: sessionLoginBodySchema }), async (req: Request, res: Response) => {
  try {
    const { idToken, rememberMe } = req.body;

    // Configurar tempo de expiração: 5 dias ou 1 hora
    const expiresIn = rememberMe ? 60 * 60 * 24 * 5 * 1000 : 60 * 60 * 1 * 1000;

    // Criar o cookie de sessão usando o Firebase Admin SDK
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Configurar opções do cookie
    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
      sameSite: 'strict' as const,
      path: '/'
    };

    res.cookie('__session', sessionCookie, options);
    logger.info(`Cookie de sessão criado com sucesso. Duração: ${expiresIn / 1000 / 3600}h, RememberMe: ${!!rememberMe}`);

    return res.status(200).send({ status: 'success' });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    logger.error('Erro ao criar cookie de sessão:', {
      errorMessage: err.message || String(error),
      errorCode: err.code,
    });

    const firebaseError = error as FirebaseError;
    const statusCode = 401;
    let errorMessage = 'Falha na autenticação. Faça login novamente.';
    let shouldLogError = true;

    switch (firebaseError.code) {
      case 'auth/id-token-expired':
        errorMessage = 'Sua sessão expirou. Faça login novamente.';
        shouldLogError = false;
        break;
      case 'auth/id-token-revoked':
        errorMessage = 'Sua sessão foi invalidada. Faça login novamente.';
        shouldLogError = false;
        break;
      default:
        return res.status(500).json({ error: "Erro interno ao processar autenticação." });
    }

    if (!shouldLogError) {
      logger.warn('Falha ao criar cookie de sessão (erro esperado):', {
        errorCode: firebaseError.code,
        errorMessage: firebaseError.message,
      });
    }

    return res.status(statusCode).send({ error: errorMessage });
  }
});

/**
 * @name Fazer Logout
 * @summary Limpa o cookie de sessão.
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('__session');
  return res.status(200).send({ status: 'success' });
});

/**
 * @name Registrar Usuário
 * @summary Cria nova identidade e perfil inicial.
 */
router.post('/register', authLimiter as unknown as RequestHandler, validate({ body: registerSchema }), async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
    } catch (authError: unknown) {
      const err = authError as FirebaseError;
      console.error('CRITICAL: authError dump ->', authError);
      if (err.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'E-mail já está em uso.' });
      }
      return res.status(500).json({ error: 'Erro ao criar conta no Firebase.', details: err.message || String(authError) });
    }

    const { uid } = userRecord;

    try {
      await db.runTransaction(async (transaction) => {
        const nickname = await generateUniqueNickname(transaction, displayName);
        const userRef = db.collection('users').doc(uid);
        const nicknameRef = db.collection('nicknames').doc(nickname);

        transaction.set(nicknameRef, { userId: uid });

        const timestamp = admin.firestore.Timestamp.now();
        const newProfileData = {
          displayName,
          nickname,
          email,
          photoURL: '',
          bio: '',
          joinedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          stats: {
            booksRead: 0,
            currentlyReading: 0,
            followers: 0,
            following: 0,
            friendsCount: 0,
            pendingRequestsCount: 0,
            sentRequestsCount: 0,
          },
          searchTerms: generateSearchTerms(displayName, nickname),
        };

        transaction.set(userRef, newProfileData);
      });

      AuditService.logAuditEvent({
        userId: uid,
        action: 'USER_REGISTERED',
        category: 'AUTH',
        ip: req.ip,
        userAgent: req.get('User-Agent')?.toString(),
        requestId: (req as Request & { requestId?: string }).requestId
      });
    } catch (dbError: unknown) {
      const err = dbError as Error;
      logger.error('CRITICAL: Erro oculto ao salvar perfil no DB:', dbError);
      await admin.auth().deleteUser(uid).catch(() => logger.error(`Falha no rollback do user ${uid}`));
      return res.status(500).json({ error: 'Erro ao configurar perfil de usuário. Tente novamente.', details: err.message || String(dbError) });
    }

    const customToken = await admin.auth().createCustomToken(uid);
    return res.status(201).json({ customToken });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
});

/**
 * @name Fazer Login
 * @summary Autentica via email/senha e gera Custom Token.
 */
router.post('/login', authLimiter as unknown as RequestHandler, validate({ body: loginSchema }), async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const apiKey = getFirebaseApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Configuração do servidor ausente (FIREBASE_API_KEY).' });
    }

    const { email, password } = updates;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    interface IdentityToolkitResponse {
      localId: string;
      error?: {
        message?: string;
      };
    }

    const data = (await response.json()) as IdentityToolkitResponse;

    if (!response.ok) {
      if (data && data.error && data.error.message) {
        const fbError = data.error.message;
        if (fbError === 'INVALID_PASSWORD' || fbError === 'EMAIL_NOT_FOUND' || fbError === 'INVALID_LOGIN_CREDENTIALS') {
          return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        } else if (fbError === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          return res.status(429).json({ error: 'Muitas tentativas falhas. Tente novamente mais tarde.' });
        } else if (fbError.includes('USER_DISABLED')) {
          return res.status(403).json({ error: 'Sua conta foi desativada.' });
        }
      }
      throw new Error(data.error?.message || 'Erro na autenticação.');
    }

    const { localId } = data;
    const customToken = await admin.auth().createCustomToken(localId);

    AuditService.logAuditEvent({
      userId: localId,
      action: 'USER_LOGIN',
      category: 'AUTH',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as Request & { requestId?: string }).requestId
    });

    return res.status(200).json({ customToken });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Erro no login do backend:', err.message || String(error));
    return res.status(500).json({ error: 'Erro interno do servidor ao tentar autenticar.' });
  }
});

/**
 * @name Recuperar Senha
 * @summary Envia e-mail de redefinição de senha.
 */
router.post('/recover', authLimiter as unknown as RequestHandler, validate({ body: recoverSchema }), async (req: Request, res: Response) => {
  try {
    const apiKey = getFirebaseApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Configuração do servidor ausente (FIREBASE_API_KEY).' });
    }

    const { email } = req.body;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
    });

    interface RecoverResponse {
      error?: {
        message?: string;
      };
    }

    const data = (await response.json()) as RecoverResponse;

    if (!response.ok) {
      if (data && data.error && data.error.message) {
        const fbError = data.error.message;
        if (fbError === 'EMAIL_NOT_FOUND') {
          return res.status(404).json({ error: 'Nenhum usuário encontrado com este e-mail.' });
        }
      }
      throw new Error(data.error?.message || 'Erro ao enviar email de recuperação.');
    }

    AuditService.logAuditEvent({
      userId: 'anonymous',
      action: 'PASSWORD_RESET_REQUESTED',
      category: 'AUTH',
      metadata: { email },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as Request & { requestId?: string }).requestId
    });

    return res.status(200).json({ message: 'E-mail enviado' });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Erro na recuperação de senha:', err.message || String(error));
    return res.status(500).json({ error: 'Erro interno ao processar recuperação.' });
  }
});

/**
 * @name Callback Login do Google
 * @summary Gerencia login/cadastro via Google Auth.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const validData = googleAuthSchema.safeParse(req.body);
    if (!validData.success) {
      return res.status(400).json({ error: 'Dados inválidos na requisição', details: validData.error.flatten() });
    }

    const { uid, email, displayName, photoURL } = validData.data;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      try {
        await db.runTransaction(async (transaction) => {
          const existingUser = await transaction.get(userRef);
          if (existingUser.exists) return;

          const nickname = await generateUniqueNickname(transaction, displayName);
          const nicknameRef = db.collection('nicknames').doc(nickname);
          transaction.set(nicknameRef, { userId: uid });

          const timestamp = admin.firestore.Timestamp.now();
          const newProfileData = {
            displayName,
            nickname,
            email,
            photoURL: photoURL || '',
            bio: '',
            joinedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
            stats: {
              booksRead: 0,
              currentlyReading: 0,
              followers: 0,
              following: 0,
              friendsCount: 0,
              pendingRequestsCount: 0,
              sentRequestsCount: 0,
            },
            searchTerms: generateSearchTerms(displayName, nickname),
          };

          transaction.set(userRef, newProfileData);
        });

        AuditService.logAuditEvent({
          userId: uid,
          action: 'USER_REGISTERED',
          category: 'AUTH',
          metadata: { provider: 'google' },
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: (req as Request & { requestId?: string }).requestId
        });

        return res.status(201).json({ message: 'Documento criado', isNewUser: true });
      } catch (tError: unknown) {
        logger.error('Erro na transaction google login', tError);
        return res.status(500).json({ error: 'Erro ao criar perfil no banco de dados.' });
      }
    }

    AuditService.logAuditEvent({
      userId: uid,
      action: 'USER_LOGIN',
      category: 'AUTH',
      metadata: { provider: 'google' },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as Request & { requestId?: string }).requestId
    });

    return res.status(200).json({ message: 'Documento já existente', isNewUser: false });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Erro login google backend:', err.message || String(error));
    return res.status(500).json({ error: 'Erro interno no callback de login.' });
  }
});

export default router;

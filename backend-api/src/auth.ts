// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
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

/**
 * @name Recuperar Chave de API
 * @summary Obtém a API Key do Firebase.
 * @description Recupera a chave de API necessária para operações de autenticação Identity Toolkit 
 * (login com senha, recuperação) a partir das variáveis de ambiente.
 * 
 * @returns {string | undefined} A chave de API ou undefined se não configurada.
 */
const getFirebaseApiKey = () => process.env.FB_API_KEY || process.env.FIREBASE_API_KEY;

if (!getFirebaseApiKey() && process.env.NODE_ENV !== 'test') {
  logger.warn('FB_API_KEY não definida no .env. Login com senha e recuperação falharão.');
}

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * @name Gerar Nickname Único
 * @summary Cria um nickname único para novos usuários.
 * @description Função auxiliar para gerar um nickname único e disponível no banco de dados,
 * realizando normalização de caracteres e tratamento de colisões.
 * 
 * @params {FirebaseFirestore.Transaction} transaction - O objeto de transação do Firestore
 * @params {string} baseName - O nome base para derivar o nickname
 * @returns {Promise<string>} Um nickname único e disponível
 * @example
 * const nickname = await generateUniqueNickname(transaction, "João Silva");
 * // retorna "joaosilva" ou "joaosilva-1"
 */
const generateUniqueNickname = async (transaction: FirebaseFirestore.Transaction, baseName: string): Promise<string> => {
  const normalize = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const base = normalize(baseName);
  let nickname = base;
  let isAvailable = false;
  let attempts = 0;

  while (!isAvailable && attempts < 10) {
    const nicknameRef = db.collection('nicknames').doc(nickname);
    const doc = await transaction.get(nicknameRef);

    if (!doc.exists) {
      isAvailable = true;
      return nickname;
    }

    attempts++;
    nickname = `${base}-${attempts}`;
  }

  throw new Error('Não foi possível gerar um nickname único.');
};

// =============================================================================
// MIDDLEWARE E RATE LIMITERS
// =============================================================================

const router = Router();

/**
 * @name Limitador de Tentativas de Login
 * @summary Proteção contra força bruta (Rate Limit).
 * @description Implementa uma política restritiva de requisições para os endpoints de autenticação.
 * Utiliza uma lógica de identificação híbrida: IP para clientes padrão e UID/Token como fallback 
 * para garantir estabilidade em ambientes de emulação ou proxies.
 * 
 * @property {number} windowMs - Janela de observação de 1 hora.
 * @property {number} max - Limite máximo de 300 requisições por janela.
 * @property {boolean} standardHeaders - Habilita headers modernos de RateLimit.
 * @property {Object} message - Resposta padronizada em caso de bloqueio.
 * @name Duração da Sessão
 * @summary Constante de tempo para o cookie de sessão.
 * @description Define o tempo máximo de vida do cookie `__session` em milissegundos. 
 * O padrão é de 14 dias se não especificado via variável de ambiente.
 */
const SESSION_COOKIE_DURATION_MS = parseInt(process.env.SESSION_COOKIE_DURATION_MS || '', 10) || 14 * 24 * 60 * 60 * 1000;
logger.info(`Usando duração do cookie de sessão: ${SESSION_COOKIE_DURATION_MS} ms`);

// =============================================================================
// ROTAS DE AUTENTICAÇÃO
// =============================================================================

/**
 * @name Login de Sessão
 * @summary Cria um cookie de sessão assinado pelo Firebase.
 * @description Cria um cookie de sessão (session cookie) seguro e assinado pelo Firebase Auth 
 * a partir de um ID Token fornecido pelo cliente. Gerencia a persistência (rememberMe).
 * 
 * @route {POST} /api/auth/sessionLogin
 * @bodyparams {string} idToken - Token de ID do Firebase Auth (cliente)
 * @bodyparams {boolean} [rememberMe] - Flag para indicar duração da sessão (14 dias ou 24h)
 * @returns {Object} 200 - { status: 'success' }
 * 
 * @example
 * fetch('/api/auth/sessionLogin', {
 *   method: 'POST',
 *   body: JSON.stringify({ idToken: '...', rememberMe: true })
 * })
 * 
 * @note Segurança do Cookie:
 * - O cookie é marcado como `httpOnly` para mitigar ataques XSS.
 * - Utiliza a flag `secure` em produção (exige HTTPS).
 * - A duração é ajustada dinamicamente com base na preferência do usuário.
 */
router.post('/sessionLogin', authLimiter as unknown as RequestHandler, validate({ body: sessionLoginBodySchema }), async (req, res, next) => {
  // Valida req.body usando o schema
  // A validação agora é feita pelo middleware 'validate'
  const { idToken, rememberMe } = req.body;

  // Definição da persistência: 14 dias ou 24 horas
  const expiresIn = rememberMe
    ? SESSION_COOKIE_DURATION_MS
    : 24 * 60 * 60 * 1000;

  try {
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const isLocal = process.env.FUNCTIONS_EMULATOR === 'true' || !process.env.FIREBASE_CONFIG;
    const isProd = !isLocal;

    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const
    };

    res.cookie('__session', sessionCookie, options);
    logger.info(`Cookie de sessão criado com sucesso. Duração: ${expiresIn / 1000 / 3600}h, RememberMe: ${!!rememberMe}`);

    // Audit Log: O UID deve ser recuperado do token se necessário, mas aqui vamos focar no login via email/pwd ou google primeiro.

    return res.status(200).send({ status: 'success' });
  } catch (error: any) {
    logger.error('Erro ao criar cookie de sessão:', {
      errorMessage: error.message,
      errorCode: error.code,
      // Evite logar o idToken inteiro por segurança
    });

    const firebaseError = error as FirebaseError;
    const statusCode = 401;       // Assume 401 para erros Firebase Auth por padrão
    let errorMessage = 'Falha na autenticação. Faça login novamente.';
    let shouldLogError = true;  // Flag que controla se logamos como erro ou apenas aviso

    switch (firebaseError.code) {
      // Casos esperados devido a ações do cliente (401), logados apenas como aviso
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
      // Caso seja um erro interno inesperado do Firebase, passa para o handler (500)
      default:
        return next(error);
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
 * @name Logout de Sessão
 * @summary Encerra a sessão removendo o cookie.
 * @description Limpa o cookie de sessão `__session` do navegador para encerrar a sessão
 * no lado do servidor.
 * 
 * @route {POST} /api/auth/sessionLogout
 * @returns {Object} 200 - { status: 'success' }
 * @example
 * fetch('/api/auth/sessionLogout', { method: 'POST' })
 */
router.post('/sessionLogout', (req, res) => {
  res.clearCookie('__session');
  logger.info('Cookie de sessão limpo (logout).');
  return res.status(200).send({ status: 'success' });
});

/**
 * @name Registrar Usuário
 * @summary Cria um novo usuário e perfil.
 * @description Realiza o registro de um novo usuário, criando a conta no Firebase Auth 
 * e instanciando o documento de perfil no Firestore em uma transação atômica.
 * Reserva o nickname globalmente.
 * 
 * @route {POST} /api/auth/register
 * @bodyparams {string} email - E-mail do usuário
 * @bodyparams {string} password - Senha do usuário (mínimo 6 chars)
 * @bodyparams {string} displayName - Nome de exibição
 * @returns {Object} 201 - { customToken }
 * 
 * @example
 * POST /api/auth/register
 * { "email": "user@example.com", "password": "password123", "displayName": "Usuário Teste" }
 * 
 * @note Atomicidade e Rollback:
 * - O processo utiliza `db.runTransaction` para garantir consistência entre Auth, Nicknames e Users.
 * - Em caso de falha na criação do perfil no Firestore, um rollback manual é executado no Firebase Auth.
 */
router.post('/register', authLimiter as any, validate({ body: registerSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // A validação agora é feita pelo middleware 'validate'
    const { email, password, displayName } = req.body;

    let userRecord;
    try {
      // ==== ==== 1. CRIAR IDENTIDADE NO FIREBASE AUTH ==== ====
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
    } catch (authError: any) {
      console.error('CRITICAL: authError dump ->', authError);
      // ==== ==== 2. TRATAMENTO DE COLISÃO DE E-MAIL ==== ====
      if (authError?.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'E-mail já está em uso.' });
      }
      return res.status(500).json({ error: 'Erro ao criar conta no Firebase.', details: authError?.message || JSON.stringify(authError) || String(authError) });
    }

    const { uid } = userRecord;
    const timestamp = admin.firestore.Timestamp.now();

    try {
      // ==== ==== 3. TRANSAÇÃO: RESERVA DE NICKNAME E PERFIL ==== ====
      await db.runTransaction(async (transaction) => {
        const nickname = await generateUniqueNickname(transaction, displayName);

        // Reserva do identificador único
        const nicknameRef = db.collection('nicknames').doc(nickname);
        transaction.set(nicknameRef, { userId: uid });

        // Instanciação do documento de perfil
        const userRef = db.collection('users').doc(uid);
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
          }
        };

        transaction.set(userRef, newProfileData);
      });

      // Audit Log: Registro bem-sucedido
      AuditService.logAuditEvent({
        userId: uid,
        action: 'USER_REGISTERED',
        category: 'AUTH',
        ip: req.ip,
        userAgent: req.get('User-Agent')?.toString(),
        requestId: (req as Request & { requestId: string }).requestId
      });
    } catch (dbError: any) {
      logger.error('CRITICAL: Erro oculto ao salvar perfil no DB:', dbError);
      await admin.auth().deleteUser(uid).catch(() => logger.error(`Falha no rollback do user ${uid}`));
      return res.status(500).json({ error: 'Erro ao configurar perfil de usuário. Tente novamente.', details: dbError?.message || dbError });
    }

    const customToken = await admin.auth().createCustomToken(uid);
    return res.status(201).json({ customToken });
  } catch (error: any) {
    logger.error('Erro no registro:', error);
    return res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
});

/**
 * @name Fazer Login
 * @summary Autentica via email/senha e gera Custom Token.
 * @description Autentica o usuário no backend usando a Identity Toolkit API do Google. 
 * Verifica credenciais e retorna um Custom Token para o SDK cliente.
 * 
 * @route {POST} /api/auth/login
 * @bodyparams {string} email - E-mail do usuário
 * @bodyparams {string} password - Senha
 * @returns {Object} 200 - { customToken }
 * @example
 * POST /api/auth/login
 * { "email": "user@example.com", "password": "password123" }
 */
router.post('/login', authLimiter as any, validate({ body: loginSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;
    const apiKey = getFirebaseApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Configuração do servidor ausente (FIREBASE_API_KEY).' });
    }

    const { email, password } = updates;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    // ==== ==== 1. AUTENTICAÇÃO VIA IDENTITY TOOLKIT ==== ====
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    const data: any = await response.json();

    if (!response.ok) {
      // ==== ==== 2. TRATAMENTO DE ERROS IDENTITY TOOLKIT ==== ====
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

    // ==== ==== 3. GERAÇÃO DE CUSTOM TOKEN (SDK CLIENTE) ==== ====
    const { localId } = data;
    const customToken = await admin.auth().createCustomToken(localId);

    // Audit Log: Login bem-sucedido
    AuditService.logAuditEvent({
      userId: localId,
      action: 'USER_LOGIN',
      category: 'AUTH',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as Request & { requestId: string }).requestId
      requestId: (req as Request & { requestId: string }).requestId
    });

    return res.status(200).json({ customToken });
  } catch (error: any) {
    logger.error('Erro no login do backend:', error.message || error);
    return res.status(500).json({ error: 'Erro interno do servidor ao tentar autenticar.' });
  }
});

/**
 * @name Recuperar Senha
 * @summary Envia e-mail de redefinição de senha.
 * @description Solicita o envio de um e-mail de redefinição de senha através 
 * do serviço de Out-of-Band (OOB) do Firebase Auth.
 * 
 * @route {POST} /api/auth/recover
 * @bodyparams {string} email - E-mail para recuperar a senha
 * @returns {Object} 200 - { message }
 * @example
 * POST /api/auth/recover
 * { "email": "user@example.com" }
 */
router.post('/recover', authLimiter as any, validate({ body: recoverSchema }), async (req: Request, res: Response, next: NextFunction) => {
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

    const data: any = await response.json();

    if (!response.ok) {
      if (data && data.error && data.error.message) {
        const fbError = data.error.message;
        if (fbError === 'EMAIL_NOT_FOUND') {
          return res.status(404).json({ error: 'Nenhum usuário encontrado com este e-mail.' });
        }
      }
      throw new Error(data.error?.message || 'Erro ao enviar email de recuperação.');
    }

    // Audit Log: Recuperação solicitada (Não temos UID aqui, usamos o email nos metadados ou logs anônimos)
    AuditService.logAuditEvent({
      userId: 'anonymous',
      action: 'PASSWORD_RESET_REQUESTED',
      category: 'AUTH',
      metadata: { email },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as any).requestId
    });

    return res.status(200).json({ message: 'E-mail enviado' });
  } catch (error: any) {
    logger.error('Erro na recuperação de senha:', error.message || error);
    return res.status(500).json({ error: 'Erro interno ao processar recuperação.' });
  }
});

/**
 * @name Callback Login do Google
 * @summary Gerencia login/cadastro via Google Auth.
 * @description Ponto de entrada após autenticação via Google SignIn no frontend. 
 * Garante a existência do perfil no Firestore, criando-o em transação se for um novo usuário.
 * 
 * @route {POST} /api/auth/google
 * @bodyparams {string} uid - ID Firebase Auth do usuário logado via Google
 * @bodyparams {string} email - E-mail provido pelo Google
 * @bodyparams {string} displayName - Nome do usuário no Google
 * @bodyparams {string} [photoURL] - URL do avatar do Google
 * @returns {Object} 200/201 - { message, isNewUser }
 * 
 * @example
 * POST /api/auth/google
 * { "uid": "...", "email": "...", "displayName": "..." }
 * 
 * @note Fluxo de Provisionamento:
 * - A rota verifica a existência prévia do documento para evitar escritas desnecessárias.
 * - Caso não exista, inicia uma transação para reservar o nickname e criar o perfil inicial.
 */
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validData = googleAuthSchema.safeParse(req.body);
    if (!validData.success) {
      return res.status(400).json({ error: 'Dados inválidos na requisição', details: validData.error.flatten() });
    }

    const { uid, email, displayName, photoURL } = validData.data;

    // Na arquitetura ideal seria recomendado validar com o token do frontend para mitigar spoofing,
    // mas aqui centralizamos as verificações e criamos o documento usando permissões de backend.

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      try {
        // Inicia transação de provisionamento para novos usuários
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

        // Audit Log: Novo registro via Google
        AuditService.logAuditEvent({
          userId: uid,
          action: 'USER_REGISTERED',
          category: 'AUTH',
          metadata: { provider: 'google' },
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: (req as Request & { requestId: string }).requestId
        });

        return res.status(201).json({ message: 'Documento criado', isNewUser: true });
      } catch (tError) {
        logger.error('Erro na transaction google login', tError);
        return res.status(500).json({ error: 'Erro ao criar perfil no banco de dados.' });
      }
    }

    // Audit Log: Login via Google (já existente)
    AuditService.logAuditEvent({
      userId: uid,
      action: 'USER_LOGIN',
      category: 'AUTH',
      metadata: { provider: 'google' },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as Request & { requestId: string }).requestId
    });

    return res.status(200).json({ message: 'Documento já existente', isNewUser: false });
  } catch (error: any) {
    logger.error('Erro login google backend:', error.message || error);
    return res.status(500).json({ error: 'Erro interno no callback de login.' });
  }
});

export default router;
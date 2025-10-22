import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { https } from 'firebase-functions';
import authRouter from './auth';
import friendsRouter from './friends';

// Inicializa o Firebase Admin antes de qualquer lógica
if (admin.apps.length === 0) {
  admin.initializeApp();
}

if (process.env.FUNCTIONS_EMULATOR === 'true') {
  //process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  logger.info('Emulator detectado, removendo variáveis de ambiente do emulador para backend-api');

  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  
  logger.info('Variáveis de ambiente do emulador removidas.');
} else {
  logger.info('Rodando em ambiente de produção ou sem emuladores definidos para backend-api.');
}

const app = express();

// Lógica de CORS com .env
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const allowedOrigin = process.env.ALLOWED_ORIGIN;

// Define a origem permitida:
// 1. Se estiver no emulador E ALLOWED_ORIGIN estiver definido no .env, use-o.
// 2. Se estiver no emulador E ALLOWED_ORIGIN NÃO estiver definido, permita TUDO (origin: true) - fallback para conveniência local.
// 3. Se NÃO estiver no emulador (produção), use o valor de ALLOWED_ORIGIN (configurado via `firebase functions:config:set` ou variável de ambiente da função). Se não estiver definido em produção, NADA será permitido (comportamento seguro padrão).
const corsOrigin = isEmulator
  ? (allowedOrigin || true) // Permite TUDO no emulador se .env não especificar
  : allowedOrigin;          // Em produção, EXIGE que a variável esteja definida

const corsOptions = {
  origin: corsOrigin,
  // Se seu frontend precisar enviar cookies (como para /sessionLogin), descomente:
  // credentials: true
};

logger.info('Configurando CORS', {
    isEmulator:       isEmulator,
    allowedOrigin:    allowedOrigin || 'N/A', // Mostra o que foi lido
    effectiveOrigin:  corsOptions.origin || 'Nenhuma (Bloqueado em prod sem config)' // Mostra o que será usado
});

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Rotas da API
app.use('/api', authRouter);
app.use('/api', friendsRouter);

export const api = https.onRequest(app);
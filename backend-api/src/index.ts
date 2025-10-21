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

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());
app.use(cookieParser());

// Rotas da API
app.use('/api', authRouter);
app.use('/api', friendsRouter);

export const api = https.onRequest(app);
import * as express from 'express';
import * as admin from 'firebase-admin';
import * as cors from 'cors';
import * as cookieParser from 'cookie-parser';
import { https } from 'firebase-functions';
import authRouter from './auth';
import friendsRouter from './friends';

// Inicializa o Firebase Admin antes de qualquer lógica
if (admin.apps.length === 0) {
  admin.initializeApp();
}

if (process.env.FUNCTIONS_EMULATOR === 'true') {
  //process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
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
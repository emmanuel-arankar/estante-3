import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import cors, { CorsOptions } from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { https } from 'firebase-functions';
import authRouter from './auth';
import friendsRouter from './friends';
import healthRouter from './health';
import { errorHandler } from './middleware/error.middleware';
import rateLimit from 'express-rate-limit';

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
// Confia no primeiro proxy (Firebase Functions/Emulator)
app.set('trust proxy', 1);

// Configuração do CORS
const allowedOrigins = process.env.FUNCTIONS_EMULATOR === 'true'
  ? [
      'http://127.0.0.1:5000', 
      'http://localhost:5000', 
      'http://localhost:5173'
    ] // Desenvolvimento
  : [
      'https://estante-virtual-805ef.web.app'
    ]; // Produção

logger.info(`Configurando CORS`, { isEmulator: process.env.FUNCTIONS_EMULATOR === 'true', allowedOrigins });

const corsOptions: CorsOptions = {
  // A propriedade 'origin' pode receber a lista diretamente.
  // O middleware 'cors' fará a verificação interna.
  origin: allowedOrigins, 
  credentials: true, // Manter para cookies de sessão
};

logger.info('Configurando CORS', {
  allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : 'Nenhuma (Bloqueado)',
});

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Define um limite geral para a maioria das rotas API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                 // Janela de 15 minutos
  max: 100,                                 // Limita cada IP a 100 requisições por janela (windowMs)
  standardHeaders: true,                    // Retorna informações do limite nos cabeçalhos `RateLimit-*`
  legacyHeaders: false,                     // Desabilita os cabeçalhos legados `X-RateLimit-*`
  message: { error: 'Muitas requisições enviadas deste IP, por favor tente novamente após 15 minutos.' },
  handler: (req, res, next, options) => {
    logger.warn('Rate limit excedido', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      limit: options.max,
      windowMs: options.windowMs
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Aplica o limiter GERAL a TODAS as rotas /api ANTES das rotas específicas
app.use('/api', apiLimiter);

// Rotas da API
app.use('/api', authRouter);                // Rotas de autenticação (agora com /sessionLogin tendo limite duplo)
app.use('/api', friendsRouter);             // Rotas de amizades
app.use('/api', healthRouter);              // Health check

// Registra o middleware de erro POR ÚLTIMO
app.use(errorHandler);

export { app };                             // Exportação nomeada para testes
export const api = https.onRequest(app);    // Exportação default para deploy
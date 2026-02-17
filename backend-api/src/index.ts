// Importa configuração centralizada do Firebase ANTES de tudo
import './firebase';

import * as logger from 'firebase-functions/logger';
import cors, { CorsOptions } from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import { onRequest } from 'firebase-functions/v2/https';
import authRouter from './auth';
import friendsRouter from './friends';
import usersRouter from './users';
import healthRouter from './health';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import rateLimit from 'express-rate-limit';

const app = express();
// Confia no primeiro proxy (Firebase Functions/Emulator)
app.set('trust proxy', 1);



// Configuração do CORS
// Detecta se está em desenvolvimento (não está em produção do Firebase Functions)
const isDevelopment = process.env.FUNCTIONS_EMULATOR === 'true' || !process.env.FIREBASE_CONFIG;

const allowedOrigins = isDevelopment
  ? [
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5173', // Adiciona suporte para 127.0.0.1
    'http://localhost:4000'
  ] // Desenvolvimento
  : [
    'https://estante-virtual-805ef.web.app'
  ]; // Produção

logger.info(`Configurando CORS`, { isDevelopment, isEmulator: process.env.FUNCTIONS_EMULATOR === 'true', allowedOrigins });

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
app.use(cookieParser() as unknown as express.RequestHandler);

// Logging de todas as requisições (ANTES do rate limiter para capturar tudo)
app.use(requestLogger);

// Define um limite geral para a maioria das rotas API
// Em desenvolvimento, limite maior para não bloquear testes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                 // Janela de 15 minutos
  max: isDevelopment ? 1000 : 100,          // 1000 em dev, 100 em prod
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

// Aplica o limiter GERAL a TODAS as rotas ANTES das rotas específicas
app.use(apiLimiter as unknown as express.RequestHandler);

// Rotas da API (sem prefixo /api porque Firebase já remove ao redirecionar)
app.use('/api', authRouter);                // Rotas de autenticação
app.use('/api', friendsRouter);             // Rotas de amizades
app.use('/api', usersRouter);               // Rotas de usuários
app.use('/api', healthRouter);              // Health check

// Registra o middleware de erro POR ÚLTIMO
app.use(errorHandler);

export { app };                             // Exportação nomeada para testes

// Exportação para deploy usando Cloud Functions v2
export const api = onRequest({
  vpcConnector: 'estante-connector',
  vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 60,
}, (req, res) => {
  // Injetar variáveis de ambiente no process.env para Redis
  if (!process.env.REDIS_HOST) {
    // Valores virão via firebase functions:secrets ou deploy command
    const redisHost = process.env.REDIS_HOST || '';
    const redisPort = process.env.REDIS_PORT || '6379';

    if (redisHost) {
      process.env.REDIS_HOST = redisHost;
      process.env.REDIS_PORT = redisPort;
    }
  }

  return app(req, res);
});
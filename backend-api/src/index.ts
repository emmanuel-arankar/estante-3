// =============================================================================
// IMPORTS E CONFIGURAÇÃO INICIAL
// =============================================================================

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
import notificationsRouter from './notifications';
import chatRouter from './chat';
import storageRouter from './storage';
import healthRouter from './health';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { responseWrapper } from './middleware/response.middleware';
import { performanceMiddleware } from './middleware/performance.middleware';
import { maintenanceMiddleware } from './middleware/maintenance.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { securityHeadersMiddleware } from './middleware/securityHeaders.middleware';
import { cacheControlMiddleware } from './middleware/cacheControl.middleware';
import { compressionMiddleware } from './middleware/compression.middleware';
import { timeoutMiddleware } from './middleware/timeout.middleware';
import { i18nMiddleware } from './middleware/i18n.middleware';
import rateLimit from 'express-rate-limit';

const app = express();
// Confia no primeiro proxy (Firebase Functions/Emulator)
app.set('trust proxy', 1);

// =============================================================================
// CONFIGURAÇÃO DE CORS
// =============================================================================

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

// =============================================================================
// MIDDLEWARES GLOBAIS
// =============================================================================

// 1. Rastreabilidade (Request ID) deve ser o primeiro
app.use(requestIdMiddleware);

// [NOVO] Proteção contra requisições lentas (Timeout)
app.use(timeoutMiddleware(30000)); // 30 segundos

// [NOVO] Internacionalização (Detectar idioma)
app.use(i18nMiddleware);

// 2. CORS - Deve vir cedo para lidar com preflight
app.use(cors(corsOptions));

// 3. Compressão de Respostas (Gzip) - Economia de banda
app.use(compressionMiddleware(1024)); // Comprime respostas > 1kb

// 4. Monitoramento de Performance (Detectar links lentos)
app.use(performanceMiddleware(1000)); // Alerta se demorar mais que 1s

// 5. Padronização de Respostas
app.use(responseWrapper);

// 6. Modo Manutenção (Kill Switch)
app.use(maintenanceMiddleware);

// 7. Headers de Segurança HTTP (HSTS, CSP, etc)
app.use(securityHeadersMiddleware);

// 8. Cache-Control Inteligente
app.use(cacheControlMiddleware);

// ==== ==== PARSERS E CONFIGURAÇÕES RESTANTES ==== ====
// Limite de 50kb no JSON para evitar ataques de DoS com payloads massivos
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser() as unknown as express.RequestHandler);

// ==== ==== LOGGING DE REQUISIÇÕES ==== ====
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

// ==== ==== APLICAR RATE LIMIT GERAL ==== ====
app.use(apiLimiter as unknown as express.RequestHandler);

// [PROPOSTA] Adicionar Helmet e Compression após resolver instalação
// import helmet from 'helmet';
// import compression from 'compression';
// app.use(helmet());
// app.use(compression());

// =============================================================================
// DEFINIÇÃO DE ROTAS (API)
// =============================================================================

// Rotas da API (sem prefixo /api porque Firebase já remove ao redirecionar)
app.use('/api', authRouter);                // Rotas de autenticação
app.use('/api', friendsRouter);             // Rotas de amizades
app.use('/api', usersRouter);               // Rotas de usuários
app.use('/api', notificationsRouter);       // Rotas de notificações
app.use('/api', chatRouter);                // Rotas de chat
app.use('/api', storageRouter);             // Rotas de storage
app.use('/api', healthRouter);              // Health check

// ==== ==== TRATAMENTO DE ERROS ==== ====
app.use(errorHandler);

export { app };                             // Exportação nomeada para testes

// =============================================================================
// EXPORTAÇÃO DE CLOUD FUNCTIONS (FIREBASE V2)
// =============================================================================

/**
 * @name API Cloud Function
 * @summary Ponto de entrada HTTPS v2 para Firebase Functions.
 * @description Exporta a aplicação {@link app} Express configurada como uma função HTTPS v2,
 * definindo VPC, região, memória e timeout. Utiliza a configuração centralizada de {@link db}.
 * 
 * @example
 * // Chamada via URL de produção ou emulador
 * https://us-central1-estante-virtual-805ef.cloudfunctions.net/api/health
 */
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
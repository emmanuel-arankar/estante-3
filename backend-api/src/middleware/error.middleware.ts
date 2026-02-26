// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { log } from '../lib/logger';
import { t } from '../lib/i18n';
import { I18nRequest } from './i18n.middleware';

// ==== ==== INTERFACES DE ERRO ==== ====

/**
 * @name Interface de Requisição Autenticada para Erros
 * @summary Extensão de Request para contexto de erro.
 * @description Estende a interface {@link Request} do Express para incluir
 * a propriedade 'user' opcional, facilitando o tracking de erros por usuário via {@link log}.
 * 
 * @property {Object} [user] - Dados básicos do usuário para auditoria
 * @property {string} user.uid - Identificador único do usuário
 * @property {string} [user.email] - E-mail do usuário
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

// ==== ==== GERENCIADOR DE ERROS (ERROR HANDLER) ==== ====

/**
 * @name Gerenciador de Erros Global
 * @summary Middleware central de tratamento de exceções.
 * @description Middleware de tratamento de erros global.
 * [FAIL-SAFE] Atua como a camada final de resiliência da API, garantindo que mesmo
 * erros inesperados resultem em uma resposta JSON válida e não derrubem o processo.
 * Captura todos os erros não tratados, registra no Cloud Logging com contexto 
 * (endpoint, user, IP) e retorna uma resposta padronizada ao cliente.
 * 
 * @params {any} err - Objeto de erro capturado (exceção, erro de validação ou erro de lógica)
 * @params {AuthenticatedRequest} req - Requisição que originou o erro {@link AuthenticatedRequest}
 * @params {Response} res - Objeto de resposta para envio do erro {@link Response}
 * @params {NextFunction} next - Função de continuidade (raramente usada em Error Handlers)
 * @example
 * app.use(errorHandler);
 */
export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: any,
  res: Response,
  next: NextFunction
): void => {
  const request = req as AuthenticatedRequest & I18nRequest;
  // [LÓGICA] Normalização do erro: 500 é o padrão para qualquer falha não mapeada.
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  // Log estruturado do erro no Cloud Logging
  log.error('API Error', err, {
    endpoint: `${request.method} ${request.path}`,
    statusCode,
    errorCode,
    userId: request.user?.uid,
    ip: request.ip,
    userAgent: request.get('user-agent'),
  });

  // Tratamento específico para erros de validação Zod
  // [UX] Flattening transforma o erro complexo do Zod em um objeto { campo: ["erro1", "erro2"] } mais fácil de consumir no front.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: t('common.validationError', request.locale),
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Resposta padrão para o cliente
  // IMPORTANTE: Não enviamos detalhes técnicos (stack trace) em ambiente de produção
  const locale = request.locale;
  res.status(statusCode).json({
    status: 'error',
    error: err.message || t('common.internalError', locale),
    code: errorCode,
    details: process.env.FUNCTIONS_EMULATOR === 'true' ? err.stack : undefined,
  });
};

// ==== ==== LISTENERS PARA EXCEÇÕES SILENCIOSAS ==== ====

/**
 * [RESILIÊNCIA] Captura de Rejeições de Promessas não tratadas (Unhandled Rejections).
 * Evita que falhas assíncronas passem despercebidas pelo sistema de logs.
 */
process.on('unhandledRejection', (reason: any) => {
  log.error('CRITICAL: Unhandled Rejection detected', reason instanceof Error ? reason : new Error(String(reason)), {
    type: 'unhandledRejection',
    timestamp: new Date().toISOString()
  });

  // Em ambientes de nuvem (Functions), o processo é reciclado automaticamente.
  // Logar o erro é o passo mais importante para diagnóstico.
});

/**
 * [RESILIÊNCIA] Captura de Exceções síncronas não tratadas (Uncaught Exceptions).
 * Última linha de defesa antes de uma falha catastrófica do processo.
 */
process.on('uncaughtException', (err: Error) => {
  log.error('FATAL: Uncaught Exception detected', err, {
    type: 'uncaughtException',
    timestamp: new Date().toISOString()
  });

  // É boa prática encerrar o processo para que o orquestrador (K8s/Cloud Functions) 
  // possa reiniciá-lo em um estado limpo.
  setTimeout(() => process.exit(1), 1000);
});
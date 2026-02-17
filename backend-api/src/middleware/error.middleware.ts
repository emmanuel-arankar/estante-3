import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { log } from '../lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

/**
 * Middleware de tratamento de erros global
 * 
 * Este é um tipo especial de middleware do Express que aceita 4 argumentos.
 * Captura todos os erros não tratados e registra no Cloud Logging.
 */
export const errorHandler = (
  err: any,
  req: AuthenticatedRequest,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  // Log estruturado do erro no Cloud Logging
  log.error('API Error', err, {
    endpoint: `${req.method} ${req.path}`,
    statusCode,
    errorCode,
    userId: req.user?.uid,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Tratamento específico para erros de validação Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Dados inválidos na requisição',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Resposta genérica para o cliente
  // Não enviar detalhes do erro (stack trace) em produção!
  res.status(statusCode).json({
    error: err.message || 'Ocorreu um erro interno no servidor.',
    code: errorCode,
    details: process.env.FUNCTIONS_EMULATOR === 'true' ? err.stack : undefined,
  });
};
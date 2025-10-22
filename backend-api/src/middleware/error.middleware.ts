import { Request, Response, NextFunction } from 'express';
import * as logger from 'firebase-functions/logger';
import { ZodError } from 'zod';

// Este é um tipo especial de middleware do Express que aceita 4 argumentos
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Log detalhado do erro no servidor (Cloud Logging)
  logger.error('Erro não tratado capturado:', {
    message: err.message,
    stack: err.stack, // Inclui o stack trace para depuração
    path: req.path,
    method: req.method,
    ip: req.ip,
    // Adicione mais contexto se útil (ex: req.user?.uid se disponível)
  });

  // Tratamento específico para erros de validação Zod que possam ter escapado
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Dados inválidos na requisição',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Resposta genérica para o cliente para erros 500
  // Não envie detalhes do erro (err.message, err.stack) para o cliente em produção!
  res.status(500).json({
    error: 'Ocorreu um erro interno no servidor.',
  });
};
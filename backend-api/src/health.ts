import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';

const router = Router();

/**
 * Endpoint GET para verificação de saúde da API.
 * Retorna status 200 e uma mensagem simples se a API estiver rodando.
 */
router.get('/health', (req: Request, res: Response) => {
  // Loga a verificação (pode ser útil para saber se o health check está sendo chamado)
  // Use debug ou info dependendo da verbosidade desejada
  logger.debug('Health check endpoint chamado', { ip: req.ip });

  // Retorna uma resposta simples indicando que a API está OK
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
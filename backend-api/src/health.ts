// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';

const router = Router();

// =============================================================================
// ROTA DE HEALTH CHECK
// =============================================================================

/**
 * @name Verificação de Saúde (Health Check)
 * @summary Endpoint para monitoramento de disponibilidade.
 * @description Rota simples para monitoramento da disponibilidade da API.
 * Retorna status 200 se o serviço estiver rodando corretamente.
 * 
 * @route {GET} /api/health
 * @returns {Object} 200 - { status: 'ok', timestamp: string }
 * 
 * @example
 * // Chamada via cURL
 * curl -X GET http://localhost:8080/api/health
 * 
 * @note Segurança e Acesso:
 * - Este endpoint é público e não exige autenticação (`checkAuth`).
 * - Utilizado por balanceadores de carga e ferramentas de uptime para validação de liveness.
 */
router.get('/health', (req: Request, res: Response) => {
  // ==== ==== LOG DE VERIFICAÇÃO ==== ====
  logger.debug('Health check endpoint chamado', { ip: req.ip });

  // Retorna uma resposta simples indicando que a API está OK
  res.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;
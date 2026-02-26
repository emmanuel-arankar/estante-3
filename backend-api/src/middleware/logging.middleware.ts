// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';

// ==== ==== INTERFACES DE LOG ==== ====

/**
 * @name Interface de Requisição Autenticada para Log
 * @summary Extensão de Request para fins de auditoria.
 * @description Estende a interface {@link Request} do Express para incluir 
 * a propriedade 'user' opcional para fins de monitoramento e métricas via {@link log}.
 * 
 * @property {Object} [user] - Dados do usuário autenticado
 * @property {string} user.uid - UID do Firebase
 * @property {string} [user.email] - E-mail vinculado
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

// ==== ==== MIDDLEWARE DE AUDITORIA (LOGGING) ==== ====

/**
 * @name Logger de Requisições
 * @summary Middleware de auditoria de tráfego.
 * @description Middleware para monitorar todas as requisições e respostas da API.
 * Registra método, caminho, latência, código de status e dispara alertas 
 * em caso de lentidão (> 2s).
 * 
 * @params {AuthenticatedRequest} req - Requisição com contexto de usuário {@link AuthenticatedRequest}
 * @params {Response} res - Resposta para interceptação de envio {@link Response}
 * @params {NextFunction} next - Função de continuidade {@link NextFunction}
 * @example
 * app.use(requestLogger);
 */
export const requestLogger = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Captura o timestamp inicial para cálculo preciso de latência no final da request
  const startTime = Date.now();
  const { method, path, ip } = req;
  const userId = req.user?.uid;

  // Log da requisição recebida (executado de forma assíncrona/não-bloqueante)
  try {
    log.info('API Request', {
      method,
      path,
      userId,
      ip,
      userAgent: req.get('user-agent'),
    });
  } catch (e) {
    // [FAIL-SAFE] Falhas no registro de log não devem interromper o ciclo da requisição
    console.error('[Middleware] Erro ao registrar log de entrada:', e);
  }

  // [TÉCNICA] Monkey Patching do método 'send'.
  // Interceptamos o envio da resposta para calcular a latência total (fim do ciclo)
  // e capturar o status final antes dos dados serem transmitidos ao cliente.
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    const endpoint = `${method} ${path}`;

    // Registro de métricas e performance (fail-safe)
    try {
      // Log da resposta
      log.info('API Response', {
        method,
        path,
        userId,
        statusCode,
        duration,
        endpoint,
      });

      // Métrica de latência
      log.metric('api_latency_ms', duration, {
        endpoint,
        statusCode,
        method,
      });

      // Monitoramento: Alerta para requisições com alta latência (> 2s)
      // [BASELINE] 2 segundos é o threshold definido para disparar alertas de performance (P99 degradado).
      if (duration > 2000) {
        log.warn('Slow API Request', {
          endpoint,
          duration,
          userId,
          statusCode,
        });
      }
    } catch (e) {
      // [FAIL-SAFE] Erros de telemetria nunca devem impedir o envio da resposta ao cliente
      console.error('[Middleware] Erro ao processar métricas de saída:', e);
    }

    return originalSend.call(this, data);
  };

  next();
};

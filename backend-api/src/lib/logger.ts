// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import * as logger from 'firebase-functions/logger';

/**
 * @name Contexto de Log
 * @summary Definição de propriedades para logs estruturados.
 * @description Interface que define as propriedades opcionais de contexto para um registro de log,
 * permitindo buscas e filtros avançados no Google Cloud Logging.
 * 
 * @property {string} [userId] - Identificador único do usuário no Firebase Auth
 * @property {string} [endpoint] - Rota da API (ex: POST /api/friends/request) para correlação
 * @property {number} [duration] - Tempo total de processamento da requisição em milissegundos
 * @property {number} [statusCode] - Código HTTP (permitindo filtrar sucessos vs erros)
 * @property {string} [errorCode] - Código de erro semântico interno para alertas específicos
 * @property {string} [method] - Verbo HTTP (GET, POST, etc)
 * @property {string} [path] - Caminho bruto da URL
 * @property {string} [ip] - IP de origem para auditoria de segurança
 */
export interface LogContext {
  userId?: string;       // Para rastreamento de atividade de usuário específico
  endpoint?: string;     // Agrupa logs por recurso/funcionalidade
  duration?: number;     // Utilizado em painéis de análise de performance (P95/P99)
  statusCode?: number;   // Identifica falhas sistêmicas (ex: erros 500)
  errorCode?: string;    // Facilita buscas por tipos de erro específicos (ZOD_ERROR, FIREBASE_ERROR)
  method?: string;
  path?: string;
  ip?: string;
  [key: string]: any;    // Permite metadados flexíveis para fluxos específicos
}

// =============================================================================
// LOGGER ESTRUTURADO
// =============================================================================

/**
 * @name Logger Centralizado
 * @summary Utilitários para logging JSON.
 * @description Utilitários de log estruturado otimizados para o Google Cloud Logging. 
 * Todos os logs foram formatados como JSON para facilitar buscas e filtros.
 * 
 * @property {(message: string, context?: LogContext) => void} info - Registra logs informativos para rastreamento de fluxo.
 * @property {(message: string, context?: LogContext) => void} warn - Registra avisos e alertas que requerem atenção.
 * @property {(message: string, error: Error, context?: LogContext) => void} error - Registra erros e exceções com captura de stack trace.
 * @property {(metricName: string, value: number, context?: LogContext) => void} metric - Registra métricas de performance e telemetria.
 * @property {(message: string, context?: LogContext) => void} debug - Registra mensagens de depuração (ativo apenas em ambiente de emulador).
 * 
 * @see [LOGGING.md](../../LOGGING.md)
 * @example
 * log.info("Operação realizada", { userId: "123" });
 */
export const log = {
  /**
   * @name Log Info
   * @summary Registra mensagem informativa.
   * @description Envia um log de severidade INFO com metadados de contexto {@link LogContext}.
   * 
   * @params {string} message - Mensagem principal do log
   * @params {LogContext} [context] - Dados adicionais para contexto
   * 
   * @note Severidade INFO é ideal para marcos de fluxo (ex: "Processo iniciado")
   */
  info: (message: string, context?: LogContext) => {
    logger.info(message, {
      ...context,
      severity: 'INFO',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * @name Log Warn
   * @summary Registra um aviso/alerta.
   * @description Registra situações de severidade WARNING que requerem atenção, mas não são erros.
   * 
   * @params {string} message - Mensagem de aviso
   * @params {LogContext} [context] - Dados adicionais para contexto
   * 
   * @note Severidade WARNING indica problemas não fatais ou uso inesperado da API
   */
  warn: (message: string, context?: LogContext) => {
    logger.warn(message, {
      ...context,
      severity: 'WARNING',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * @name Log Error
   * @summary Registra erro ou exceção.
   * @description Captura erros fatais, incluindo stack trace e detalhes da exceção.
   * 
   * @params {string} message - Descrição do erro
   * @params {Error} [error] - Objeto de erro original para captura de stack trace
   * @params {LogContext} [context] - Dados adicionais para contexto
   * 
   * @note Severidade ERROR deve ser usada apenas para falhas que interrompem o fluxo esperado
   */
  error: (message: string, error?: Error | any, context?: LogContext) => {
    logger.error(message, {
      ...context,
      severity: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error ? {
        message: error.message || error.toString(),
        stack: error.stack,
        name: error.name || 'Error',
      } : undefined,
    });
  },

  /**
   * @name Log Metric
   * @summary Registra métrica de telemetria.
   * @description Captura dados numéricos para monitoramento de performance ou uso.
   * 
   * @params {string} metricName - Nome identificador da métrica
   * @params {number} value - Valor numérico da métrica
   * @params {LogContext} [context] - Dados adicionais para contexto
   * 
   * @note Útil para monitorar latência, contagem de eventos e taxas de sucesso/erro
   */
  metric: (metricName: string, value: number, context?: LogContext) => {
    logger.info(`METRICA: ${metricName}`, {
      ...context,
      metricName,
      metricValue: value,
      severity: 'INFO',
      timestamp: new Date().toISOString(),
      labels: {
        type: 'metric',
        ...(context?.labels || {})
      },
    });
  },

  /**
   * @name Log Debug
   * @summary Mensagem de depuração local.
   * @description Registra mensagens visíveis apenas durante o desenvolvimento no emulador.
   * 
   * @params {string} message - Mensagem de depuração
   * @params {LogContext} [context] - Dados adicionais para contexto
   * 
   * @note Logs de depuração não são enviados para o Cloud Logging em produção
   */
  debug: (message: string, context?: LogContext) => {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      logger.debug(message, {
        ...context,
        severity: 'DEBUG',
        timestamp: new Date().toISOString(),
      });
    }
  },
};

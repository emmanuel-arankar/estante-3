import * as logger from 'firebase-functions/logger';

export interface LogContext {
    userId?: string;
    endpoint?: string;
    duration?: number;
    statusCode?: number;
    errorCode?: string;
    method?: string;
    path?: string;
    ip?: string;
    [key: string]: any;
}

/**
 * Structured logging helpers para Cloud Logging
 * 
 * Todos os logs seguem um formato JSON padronizado que facilita
 * queries e análises no Google Cloud Logging.
 */
export const log = {
    /**
     * Log de informação geral
     */
    info: (message: string, context?: LogContext) => {
        logger.info(message, {
            ...context,
            severity: 'INFO',
            timestamp: new Date().toISOString(),
        });
    },

    /**
     * Log de aviso (situações que merecem atenção mas não são erros)
     */
    warn: (message: string, context?: LogContext) => {
        logger.warn(message, {
            ...context,
            severity: 'WARNING',
            timestamp: new Date().toISOString(),
        });
    },

    /**
     * Log de erro com stack trace
     */
    error: (message: string, error: Error, context?: LogContext) => {
        logger.error(message, {
            ...context,
            severity: 'ERROR',
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
        });
    },

    /**
     * Log de métrica customizada
     * Útil para rastrear valores numéricos (latência, contadores, etc)
     */
    metric: (metricName: string, value: number, context?: LogContext) => {
        logger.info(`METRIC: ${metricName}`, {
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
     * Log de debug (só aparece em desenvolvimento)
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

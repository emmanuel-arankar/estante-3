import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

/**
 * @name Categorias de Auditoria
 * @summary Agrupamento lógico de ações para facilitar filtragem.
 */
export type AuditCategory = 'AUTH' | 'USER' | 'SOCIAL' | 'CONTENT' | 'SYSTEM' | 'SECURITY';

/**
 * @name Tipos de Ações de Auditoria
 * @summary Identificadores únicos para cada ação rastreável.
 */
export type AuditAction =
    // AUTH
    | 'USER_LOGIN' | 'USER_REGISTERED' | 'PASSWORD_RESET_REQUESTED'
    // USER
    | 'PROFILE_UPDATED' | 'ACCOUNT_DELETED' | 'ROLE_CHANGED'
    // SOCIAL
    | 'FRIEND_REQUEST_SENT' | 'FRIEND_REQUEST_ACCEPTED' | 'FRIEND_REMOVED' | 'USER_BLOCKED' | 'USER_UNBLOCKED'
    // CONTENT
    | 'MESSAGE_DELETED' | 'CONVERSATION_DELETED' | 'FILE_DELETED' | 'FILE_UPLOADED'
    // SYSTEM
    | 'MAINTENANCE_MODE_TOGGLED' | 'RATE_LIMIT_HIT';

/**
 * @name Parâmetros do Evento de Auditoria
 * @summary Estrutura de dados para registro de um log.
 */
export interface AuditEventParams {
    userId: string;          // Quem fez a ação
    action: AuditAction;     // O que foi feito
    category: AuditCategory; // Categoria da ação
    resourceId?: string;     // ID do objeto afetado (ex: targetUserId, messageId)
    metadata?: Record<string, unknown>; // Dados adicionais (ex: diff de campos)
    ip?: string;             // IP da requisição
    userAgent?: string;      // Browser/Device
    requestId?: string;      // ID da requisição correlacionado
}

/**
 * @name Serviço de Auditoria
 * @summary Centraliza o registro de logs persistentes no Firestore.
 */
export const AuditService = {
    /**
     * @description Registra um novo evento de auditoria no Firestore.
     * @param params - Dados do evento
     */
    async logAuditEvent(params: AuditEventParams): Promise<void> {
        try {
            const auditLog = {
                ...params,
                timestamp: FieldValue.serverTimestamp(),
            };

            // Persiste na coleção audit_logs de forma assíncrona
            // Nota: Não aguardamos o resultado para não bloquear a resposta da API,
            // mas logamos erros se a persistência falhar.
            db.collection('audit_logs').add(auditLog).catch(err => {
                logger.error('Falha ao persistir log de auditoria no Firestore', {
                    error: err.message,
                    event: params.action,
                    userId: params.userId
                });
            });

            // Também enviamos para o logger do cloud para visibilidade imediata
            logger.info(`[AUDIT] ${params.category}:${params.action}`, {
                userId: params.userId,
                resourceId: params.resourceId,
                requestId: params.requestId
            });

        } catch (error) {
            // Safe guard para garantir que a auditoria nunca quebre o fluxo principal
            logger.error('Erro crítico no serviço de auditoria', error);
        }
    }
};

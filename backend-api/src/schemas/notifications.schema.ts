// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';

/**
 * @name Schema de Consulta de Notificações
 * @summary Filtros e paginação de notificações.
 * @description Valida os parâmetros de query para busca de notificações do usuário.
 * 
 * @property {number} [page=1] - Índice da página para paginação
 * @default 1
 * @property {number} [limit=20] - Máximo de itens por página (máx 50)
 * @default 20
 * @property {boolean} [unreadOnly=false] - Se deve filtrar apenas não lidas
 * @default false
 * @property {string} [cursor] - Marcador de paginação
 * @example
 * { "page": 1, "unreadOnly": true }
 */
export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
  cursor: z.string().optional(),
});

/**
 * @name Tipo ListNotificationsQuery
 * @summary Tipo inferido para consulta de notificações.
 * @description Estrutura de filtros e paginação para o endpoint de listagem.
 * 
 * @typedef {z.infer<typeof listNotificationsQuerySchema>} ListNotificationsQuery
 */
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/**
 * @name Schema de ID de Notificação
 * @summary Valida ID único de uma notificação.
 * @description Usado para rotas que operam em uma única notificação específica.
 * 
 * @property {string} notificationId - Identificador único da notificação no {@link db}
 * @example
 * { "notificationId": "NOTIF123" }
 */
export const notificationIdParamSchema = z.object({
  notificationId: z.string().min(1),
});

/**
 * @name Tipo NotificationIdParam
 * @summary Tipo inferido para parâmetro de ID.
 * @description Identificador único de uma notificação para operações individuais.
 * 
 * @typedef {z.infer<typeof notificationIdParamSchema>} NotificationIdParam
 */
export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;

/**
 * @name Schema de Leitura em Lote
 * @summary Valida atualização massiva para lido.
 * @description Marcar múltiplas notificações como lidas simultaneamente via batch do Firestore.
 * 
 * @bodyparams {string[]} notificationIds - Array de IDs de notificações (máx 50)
 * @example
 * // Marcar notificações como lidas
 * { "notificationIds": ["NOTIF1", "NOTIF2"] }
 */
export const markMultipleReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1).max(50),
});

/**
 * @name Tipo MarkMultipleRead
 * @summary Tipo inferido para leitura em lote.
 * @description Payload para marcar simultaneamente várias notificações como lidas.
 * 
 * @typedef {z.infer<typeof markMultipleReadSchema>} MarkMultipleRead
 */
export type MarkMultipleRead = z.infer<typeof markMultipleReadSchema>;

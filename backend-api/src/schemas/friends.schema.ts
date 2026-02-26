// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';

/**
 * @name Schema de Busca de Amigos
 * @summary Valida parâmetros de pesquisa por texto.
 * @description Valida o termo de busca (searchTerm) garantindo tamanho mínimo.
 * 
 * @property {string} searchTerm - Termo de busca textual (mínimo 2 caracteres para performance)
 * @example
 * { "searchTerm": "joão" }
 */
export const findFriendsQuerySchema = z.object({
  searchTerm: z.string()
    .trim() // Remove espaços extras
    .min(2, { message: 'O termo de busca deve ter no mínimo 2 caracteres' })
});

/**
 * @name Tipo FindFriendsQuery
 * @summary Tipo inferido para busca de amigos.
 * @description Estrutura de parâmetros para filtragem textual de novos amigos.
 * 
 * @typedef {z.infer<typeof findFriendsQuerySchema>} FindFriendsQuery
 */
export type FindFriendsQuery = z.infer<typeof findFriendsQuerySchema>;

/**
 * @name Schema de Solicitação de Amizade
 * @summary Valida envio de novo pedido.
 * @description Garante que o ID do usuário alvo esteja presente para iniciar uma relação.
 * 
 * @bodyparams {string} targetUserId - ID do destinatário da solicitação
 * @example
 * // Envio de pedido simples
 * { "targetUserId": "UID_123456" }
 */
export const sendFriendRequestSchema = z.object({
  targetUserId: z.string()
    .trim()
    .min(1, { message: 'targetUserId é obrigatório' })
});

/**
 * @name Tipo SendFriendRequest
 * @summary Tipo inferido para envio de solicitação.
 * @description Define a carga útil necessária para disparar um novo pedido de amizade.
 * 
 * @typedef {z.infer<typeof sendFriendRequestSchema>} SendFriendRequest
 */
export type SendFriendRequest = z.infer<typeof sendFriendRequestSchema>;

/**
 * @name Schema de ID de Amizade
 * @summary Valida parâmetro de ID da relação.
 * @description Validação de ID de amizade no formato esperado (UID1_UID2).
 * 
 * @property {string} friendshipId - ID composto no formato 'UID1_UID2'. Veja {@link updateMutualFriendsForNewFriendship}.
 * @example
 * { "friendshipId": "UID1_UID2" }
 */
export const friendshipIdParamSchema = z.object({
  friendshipId: z.string()
    .trim()
    .min(1, { message: 'friendshipId é obrigatório' })
});

/**
 * @name Tipo FriendshipIdParam
 * @summary Tipo inferido para ID de relação.
 * @description Representa o parâmetro de URL que identifica uma amizade (ID composto).
 * 
 * @typedef {z.infer<typeof friendshipIdParamSchema>} FriendshipIdParam
 */
export type FriendshipIdParam = z.infer<typeof friendshipIdParamSchema>;

/**
 * @name Schema de Status de Amizade
 * @summary Valida verificação de amizade.
 * @description Verificação de status através do ID do usuário.
 * 
 * @property {string} userId - ID do usuário para checar relação
 * @example
 * { "userId": "UID_ALVO" }
 */
export const friendshipStatusParamSchema = z.object({
  userId: z.string()
    .trim()
    .min(1, { message: 'userId é obrigatório' })
});

/**
 * @name Tipo FriendshipStatusParam
 * @summary Tipo inferido para verificação de status.
 * @description Parâmetro para consultar se existe relação entre o usuário logado e outro UID.
 * 
 * @typedef {z.infer<typeof friendshipStatusParamSchema>} FriendshipStatusParam
 */
export type FriendshipStatusParam = z.infer<typeof friendshipStatusParamSchema>;

/**
 * @name Schema de Listagem de Amigos
 * @summary Valida query params de listagem.
 * @description Validação rica para paginação, ordenação e filtros de busca.
 * 
 * @property {number} [page=1] - Índice da página
 * @default 1
 * @property {number} [limit=20] - Máximo de itens (1-100)
 * @default 20
 * @property {string} [search] - Filtro textual opcional
 * @property {string} [sortBy='friendshipDate'] - Campo ordenador
 * @default 'friendshipDate'
 * @property {string} [sortDirection='desc'] - Sentido da ordenação
 * @default 'desc'
 * @property {string} [cursor] - Ponto de partida para paginação infinita
 * @example
 * { "page": 1, "limit": 20, "sortBy": "friendshipDate" }
 */
export const listFriendsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.enum(['name', 'nickname', 'friendshipDate']).default('friendshipDate'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().optional(),
});

/**
 * @name Tipo ListFriendsQuery
 * @summary Tipo inferido para listagem de amigos.
 * @description Suporta paginação, filtros e ordenação na busca por amizades existentes.
 * 
 * @typedef {z.infer<typeof listFriendsQuerySchema>} ListFriendsQuery
 */
export type ListFriendsQuery = z.infer<typeof listFriendsQuerySchema>;

/**
 * @name Schema de Listagem de Pedidos
 * @summary Valida query de solicitações pendentes.
 * @description Listagem de pedidos de amizade pendentes com paginação e busca.
 * 
 * @property {number} [page=1] - Página atual
 * @default 1
 * @property {number} [limit=20] - Limite por página
 * @default 20
 * @property {string} [search] - Filtro de busca por nome
 * @property {string} [cursor] - Cursor para paginação
 * @example
 * { "page": 2, "limit": 10 }
 */
export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  cursor: z.string().optional(),
});

/**
 * @name Tipo ListRequestsQuery
 * @summary Tipo inferido para listagem de pedidos.
 * @description Filtros e paginação para visualizar solicitações de amizade recebidas.
 * 
 * @typedef {z.infer<typeof listRequestsQuerySchema>} ListRequestsQuery
 */
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

/**
 * @name Schema de Operações em Lote
 * @summary Valida arrays de IDs para bulk actions.
 * @description Garante que a lista de amigos contenha entre 1 e 50 IDs válidos para aceitação ou rejeição massiva.
 * 
 * @note O limite de 50 itens é definido para respeitar o limite máximo de escritas
 * permitidas em uma única transação/batch do Firestore, evitando falhas de timeout.
 * 
 * @bodyparams {string[]} friendIds - Lista de UIDs para operação massiva
 * @example
 * // Aceitar lista de amigos em bloco
 * { "friendIds": ["UID1", "UID2", "UID3"] }
 */
export const bulkFriendshipSchema = z.object({
  friendIds: z.array(
    z.string().trim().min(1, { message: 'friendId não pode ser vazio' })
  )
    .min(1, { message: 'Pelo menos um friendId é obrigatório' })
    .max(50, { message: 'Máximo de 50 operações por lote' }),
});

/**
 * @name Tipo BulkFriendship
 * @summary Tipo inferido para ações massivas.
 * @description Lista de IDs para aceitar ou rejeitar múltiplas amizades em uma única operação.
 * 
 * @typedef {z.infer<typeof bulkFriendshipSchema>} BulkFriendship
 */
export type BulkFriendship = z.infer<typeof bulkFriendshipSchema>;
import { z } from 'zod';

export const findFriendsQuerySchema = z.object({
  searchTerm: z.string()
    .trim() // Remove espaços extras
    .min(2, { message: 'O termo de busca deve ter no mínimo 2 caracteres' })
});

// Schema para enviar solicitação de amizade
export const sendFriendRequestSchema = z.object({
  targetUserId: z.string()
    .trim()
    .min(1, { message: 'targetUserId é obrigatório' })
});

// Schema para aceitar/rejeitar solicitação (via params)
export const friendshipIdParamSchema = z.object({
  friendshipId: z.string()
    .trim()
    .min(1, { message: 'friendshipId é obrigatório' })
});

// Schema para verificar status de amizade
export const friendshipStatusParamSchema = z.object({
  userId: z.string()
    .trim()
    .min(1, { message: 'userId é obrigatório' })
});

// Schema para listagem de amigos (GET /api/friendships)
export const listFriendsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.enum(['name', 'nickname', 'friendshipDate']).default('friendshipDate'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().optional(), // Para paginação baseada em cursor (escalável)
});

// Schema para listagem de pedidos (GET /api/friendships/requests e /sent)
export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  cursor: z.string().optional(),
});

// Schema para ações em lote (bulk-accept, bulk-reject, bulk-cancel)
export const bulkFriendshipSchema = z.object({
  friendIds: z.array(
    z.string().trim().min(1, { message: 'friendId não pode ser vazio' })
  )
    .min(1, { message: 'Pelo menos um friendId é obrigatório' })
    .max(50, { message: 'Máximo de 50 operações por lote' }),
});
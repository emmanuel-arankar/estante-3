/**
 * Serviço centralizado para operações de amizade via backend-api
 * Todas as operações de friendship passam por aqui — sem acesso direto ao Firestore
 */

import { DenormalizedFriendship } from '@estante/common-types';
import { invalidateMutualFriendsCache } from '@/features/friends/hooks/useMutualFriendsCache';
import { apiClient } from '@/services/api/apiClient';

// ==================== TIPOS ====================

type FriendshipStatus = 'none' | 'friends' | 'request_sent' | 'request_received' | 'self';

interface ApiResponse {
  message?: string;
  error?: string;
}

interface FriendshipStatusResponse {
  status: FriendshipStatus;
}

interface MutualFriend {
  id: string;
  displayName: string;
  nickname: string;
  photoURL: string | null;
}

export interface MutualFriendsResponse {
  count: number;
  friends: MutualFriend[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor?: string; // Cursor para próxima página (escalabilidade)
  };
}

export interface ListFriendsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'nickname' | 'friendshipDate';
  sortDirection?: 'asc' | 'desc';
  cursor?: string; // Paginação via cursor
}

export interface ListRequestsParams {
  page?: number;
  limit?: number;
  search?: string;
  cursor?: string; // Paginação via cursor
}

export interface BulkActionResponse {
  message: string;
  accepted?: string[];
  rejected?: string[];
  cancelled?: string[];
  skipped?: Array<{ friendId: string; reason: string }>;
}

export interface SyncProfileResponse {
  message: string;
  updated: number;
}

export interface UserStatsResponse {
  totalFriends: number;
  pendingRequests: number;
  sentRequests: number;
}

// ==================== UTILITÁRIOS ====================

/**
 * Converte timestamp do Firestore (serializado via JSON) para Date
 */
const parseFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date._seconds !== undefined) return new Date(date._seconds * 1000);
  if (date.seconds !== undefined) return new Date(date.seconds * 1000);
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  return new Date();
};

/**
 * Converte resposta JSON da API para DenormalizedFriendship tipado
 */
const parseDenormalizedFriendship = (raw: any): DenormalizedFriendship => ({
  id: raw.id,
  userId: raw.userId,
  friendId: raw.friendId,
  status: raw.status,
  requestedBy: raw.requestedBy,
  createdAt: parseFirestoreDate(raw.createdAt),
  updatedAt: parseFirestoreDate(raw.updatedAt),
  friendshipDate: raw.friendshipDate ? parseFirestoreDate(raw.friendshipDate) : undefined,
  friend: {
    id: raw.friend?.id || raw.friendId,
    displayName: raw.friend?.displayName || '',
    nickname: raw.friend?.nickname || '',
    photoURL: raw.friend?.photoURL || undefined,
    email: raw.friend?.email || '',
    bio: raw.friend?.bio || '',
    location: raw.friend?.location || '',
    joinedAt: parseFirestoreDate(raw.friend?.joinedAt),
    lastActive: raw.friend?.lastActive ? parseFirestoreDate(raw.friend.lastActive) : undefined,
  },
  mutualFriendsCount: raw.mutualFriendsCount,
});

/**
 * Helper para construir query string a partir de params
 */
const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

// ==================== OPERAÇÕES INDIVIDUAIS ====================

/**
 * Envia solicitação de amizade
 */
export const sendFriendRequestAPI = async (targetUserId: string): Promise<void> => {
  await apiClient('/friendships/request', {
    method: 'POST',
    data: { targetUserId },
  });
};

/**
 * Aceita solicitação de amizade e invalida cache de amigos em comum
 */
export const acceptFriendRequestAPI = async (friendshipId: string): Promise<void> => {
  await apiClient(`/friendships/${friendshipId}/accept`, {
    method: 'POST',
  });

  const [userId, friendIdStr] = friendshipId.split('_');
  invalidateMutualFriendsCache(userId);
  invalidateMutualFriendsCache(friendIdStr);
};

/**
 * Rejeita/cancela solicitação ou remove amizade e invalida cache
 */
export const removeFriendshipAPI = async (friendshipId: string): Promise<void> => {
  await apiClient(`/friendships/${friendshipId}`, {
    method: 'DELETE',
  });

  const [userId, friendIdStr] = friendshipId.split('_');
  invalidateMutualFriendsCache(userId);
  invalidateMutualFriendsCache(friendIdStr);
};

/**
 * Verifica status de amizade com um usuário
 */
export const getFriendshipStatusAPI = async (targetUserId: string): Promise<FriendshipStatus> => {
  const data = await apiClient<FriendshipStatusResponse>(`/friendships/status/${targetUserId}`);
  return data.status;
};

/**
 * Calcula amigos em comum com outro usuário
 */
export const getMutualFriendsAPI = async (targetUserId: string): Promise<MutualFriendsResponse> => {
  return await apiClient<MutualFriendsResponse>(`/friendships/mutual/${targetUserId}`);
};

/**
 * Bloqueia um usuário
 */
export const blockUserAPI = async (targetUserId: string): Promise<void> => {
  const response = await apiClient<{ blockId?: string }>('/friendships/block', {
    method: 'POST',
    data: { targetUserId },
  });

  // Invalidar caches relevantes
  const [userId] = response.blockId?.split('_') || [];
  if (userId) {
    invalidateMutualFriendsCache(userId);
  }
};

/**
 * Desbloqueia um usuário
 */
export const unblockUserAPI = async (targetUserId: string): Promise<void> => {
  await apiClient('/friendships/unblock', {
    method: 'POST',
    data: { targetUserId },
  });
};

export interface BlockedUser {
  id: string;
  displayName: string;
  nickname: string;
  photoURL: string | null;
}

/**
 * Lista usuários bloqueados
 */
export const listBlockedUsersAPI = async (): Promise<BlockedUser[]> => {
  const json = await apiClient<{ data: BlockedUser[] }>('/friendships/blocking/list');
  return json.data;
};

// ==================== LISTAGEM ====================

/**
 * Lista amigos aceitos com paginação, busca e ordenação
 */
export const listFriendsAPI = async (
  params?: ListFriendsParams
): Promise<PaginatedResponse<DenormalizedFriendship>> => {
  const qs = buildQueryString(params || {});
  const json = await apiClient<{ data: any[], pagination: any }>(`/friendships${qs}`);

  return {
    data: (json.data || []).map(parseDenormalizedFriendship),
    pagination: json.pagination,
  };
};

/**
 * Lista pedidos de amizade recebidos pendentes
 */
export const listRequestsAPI = async (
  params?: ListRequestsParams
): Promise<PaginatedResponse<DenormalizedFriendship>> => {
  const qs = buildQueryString(params || {});
  const json = await apiClient<{ data: any[], pagination: any }>(`/friendships/requests${qs}`);

  return {
    data: (json.data || []).map(parseDenormalizedFriendship),
    pagination: json.pagination,
  };
};

/**
 * Lista pedidos de amizade enviados pendentes
 */
export const listSentRequestsAPI = async (
  params?: ListRequestsParams
): Promise<PaginatedResponse<DenormalizedFriendship>> => {
  const qs = buildQueryString(params || {});
  const json = await apiClient<{ data: any[], pagination: any }>(`/friendships/sent${qs}`);

  return {
    data: (json.data || []).map(parseDenormalizedFriendship),
    pagination: json.pagination,
  };
};

// ==================== AÇÕES EM LOTE ====================

/**
 * Aceita múltiplas solicitações de amizade
 */
export const bulkAcceptAPI = async (friendIds: string[]): Promise<BulkActionResponse> => {
  const response = await apiClient<BulkActionResponse>('/friendships/bulk-accept', {
    method: 'POST',
    data: { friendIds },
  });

  invalidateMutualFriendsCache();
  return response;
};

/**
 * Rejeita múltiplas solicitações recebidas
 */
export const bulkRejectAPI = async (friendIds: string[]): Promise<BulkActionResponse> => {
  return await apiClient<BulkActionResponse>('/friendships/bulk-reject', {
    method: 'POST',
    data: { friendIds },
  });
};

/**
 * Cancela múltiplas solicitações enviadas
 */
export const bulkCancelAPI = async (friendIds: string[]): Promise<BulkActionResponse> => {
  return await apiClient<BulkActionResponse>('/friendships/bulk-cancel', {
    method: 'POST',
    data: { friendIds },
  });
};

// ==================== SINCRONIZAÇÃO ====================

/**
 * Sincroniza dados denormalizados do perfil em todas as amizades
 * Deve ser chamado após edição de perfil ou foto
 */
export const syncProfileAPI = async (): Promise<SyncProfileResponse> => {
  return await apiClient<SyncProfileResponse>('/friendships/sync-profile', {
    method: 'POST',
  });
};

/**
 * Busca estatísticas de amizade do usuário atual (friends, requests, sent)
 */
export const getUserStatsAPI = async (): Promise<UserStatsResponse> => {
  return await apiClient<UserStatsResponse>('/users/me/stats');
};
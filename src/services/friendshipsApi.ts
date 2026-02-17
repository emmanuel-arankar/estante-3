/**
 * Serviço centralizado para operações de amizade via backend-api
 * Todas as operações de friendship passam por aqui — sem acesso direto ao Firestore
 */

import { DenormalizedFriendship } from '@estante/common-types';
import { invalidateMutualFriendsCache } from '@/hooks/useMutualFriendsCache';

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

/**
 * Helper para tratar erros de API de forma robusta
 * Tenta fazer parse do JSON de erro, mas fornece fallback seguro
 */
const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = `Erro da API (${response.status})`;

  console.log(`[handleApiError] Status: ${response.status} ${response.statusText}`);

  try {
    const contentType = response.headers.get('content-type');
    console.log(`[handleApiError] Content-Type: ${contentType}`);

    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      console.log(`[handleApiError] Body Text:`, text);

      try {
        const errorData = JSON.parse(text) as ApiResponse;
        if (errorData.error) {
          errorMessage = errorData.error;
        } else {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
      } catch (e) {
        console.error('[handleApiError] Falha ao fazer parse do body JSON:', e);
      }
    } else {
      const text = await response.text();
      console.log(`[handleApiError] Body Text (Non-JSON):`, text.substring(0, 500)); // Logar início do erro (pode ser HTML)
      errorMessage = `${errorMessage}: ${response.statusText}`;
    }
  } catch (parseError) {
    console.error('Erro ao ler resposta de erro:', parseError);
    errorMessage = `${errorMessage}: ${response.statusText}`;
  }

  console.error(`[handleApiError] Throwing: ${errorMessage}`);
  throw new Error(errorMessage);
};

// ==================== OPERAÇÕES INDIVIDUAIS ====================

/**
 * Envia solicitação de amizade
 */
export const sendFriendRequestAPI = async (targetUserId: string): Promise<void> => {
  const response = await fetch('/api/friendships/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }
};

/**
 * Aceita solicitação de amizade e invalida cache de amigos em comum
 */
export const acceptFriendRequestAPI = async (friendshipId: string): Promise<void> => {
  const response = await fetch(`/api/friendships/${friendshipId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  // Invalidar cache de amigos em comum para ambos os usuários
  const [userId, friendId] = friendshipId.split('_');
  invalidateMutualFriendsCache(userId);
  invalidateMutualFriendsCache(friendId);
};

/**
 * Rejeita/cancela solicitação ou remove amizade e invalida cache
 */
export const removeFriendshipAPI = async (friendshipId: string): Promise<void> => {
  const response = await fetch(`/api/friendships/${friendshipId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const [userId, friendId] = friendshipId.split('_');
  invalidateMutualFriendsCache(userId);
  invalidateMutualFriendsCache(friendId);
};

/**
 * Verifica status de amizade com um usuário
 */
export const getFriendshipStatusAPI = async (targetUserId: string): Promise<FriendshipStatus> => {
  const response = await fetch(`/api/friendships/status/${targetUserId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const data = await response.json() as FriendshipStatusResponse;
  return data.status;
};

/**
 * Calcula amigos em comum com outro usuário
 */
export const getMutualFriendsAPI = async (targetUserId: string): Promise<MutualFriendsResponse> => {
  const response = await fetch(`/api/friendships/mutual/${targetUserId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return await response.json() as MutualFriendsResponse;
};

/**
 * Bloqueia um usuário
 */
export const blockUserAPI = async (targetUserId: string): Promise<void> => {
  const response = await fetch('/api/friendships/block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  // Invalidar caches relevantes
  const [userId] = (await response.clone().json() as any).blockId?.split('_') || [];
  if (userId) {
    invalidateMutualFriendsCache(userId);
  }
};

/**
 * Desbloqueia um usuário
 */
export const unblockUserAPI = async (targetUserId: string): Promise<void> => {
  const response = await fetch('/api/friendships/unblock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }
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
  const response = await fetch('/api/friendships/blocking/list', {
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const json = await response.json();
  return json.data as BlockedUser[];
};

// ==================== LISTAGEM ====================

/**
 * Lista amigos aceitos com paginação, busca e ordenação
 */
export const listFriendsAPI = async (
  params?: ListFriendsParams
): Promise<PaginatedResponse<DenormalizedFriendship>> => {
  const qs = buildQueryString(params || {});
  const response = await fetch(`/api/friendships${qs}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json() as ApiResponse;
    throw new Error(errorData.error || `Erro da API: ${response.statusText}`);
  }

  const json = await response.json();
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
  const response = await fetch(`/api/friendships/requests${qs}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const json = await response.json();
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
  const response = await fetch(`/api/friendships/sent${qs}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const json = await response.json();
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
  const response = await fetch('/api/friendships/bulk-accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ friendIds }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  invalidateMutualFriendsCache();
  return await response.json() as BulkActionResponse;
};

/**
 * Rejeita múltiplas solicitações recebidas
 */
export const bulkRejectAPI = async (friendIds: string[]): Promise<BulkActionResponse> => {
  const response = await fetch('/api/friendships/bulk-reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ friendIds }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return await response.json() as BulkActionResponse;
};

/**
 * Cancela múltiplas solicitações enviadas
 */
export const bulkCancelAPI = async (friendIds: string[]): Promise<BulkActionResponse> => {
  const response = await fetch('/api/friendships/bulk-cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ friendIds }),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return await response.json() as BulkActionResponse;
};

// ==================== SINCRONIZAÇÃO ====================

/**
 * Sincroniza dados denormalizados do perfil em todas as amizades
 * Deve ser chamado após edição de perfil ou foto
 */
export const syncProfileAPI = async (): Promise<SyncProfileResponse> => {
  const response = await fetch('/api/friendships/sync-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return await response.json() as SyncProfileResponse;
};

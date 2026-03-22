import { User } from '@estante/common-types';
import { apiClient } from '@/services/api/apiClient';

/**
 * Definição de query reutilizável para buscar um usuário pelo ID.
 * Usada para pré-aquecer o cache ou buscar dados em loaders/actions.
 */
export const userQuery = (userId: string) => ({
  queryKey: ['users', userId],
  queryFn: () => apiClient<User>(`/users/${userId}`),
});

/**
 * Definição de query reutilizável para buscar um usuário pelo nickname.
 */
export const userByNicknameQuery = (nickname: string) => ({
  queryKey: ['users', 'nickname', nickname],
  queryFn: () => apiClient<User>(`/users/by-nickname/${encodeURIComponent(nickname)}`),
});

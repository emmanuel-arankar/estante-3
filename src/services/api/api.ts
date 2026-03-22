import { User } from '@estante/common-types';
import { apiClient } from '@/services/api/apiClient';

/**
 * Busca usuários na API.
 * @param searchTerm O termo para buscar.
 * @returns Uma promessa com a lista de usuários encontrados.
 */
export const searchUsersAPI = async (searchTerm: string): Promise<User[]> => {
  if (searchTerm.trim().length < 2) {
    return [];
  }

  try {
    const results = await apiClient<User[]>(`/findFriends?searchTerm=${encodeURIComponent(searchTerm)}`);
    return results;
  } catch (error) {
    console.error('Falha ao buscar usuários na API:', error);
    throw error;
  }
};

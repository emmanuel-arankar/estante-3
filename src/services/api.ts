import { User } from '@/models';

// # removido - A URL base não é mais necessária
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
    // # atualizado - Faz a chamada para um caminho relativo
    const response = await fetch(`/api/findFriends?searchTerm=${encodeURIComponent(searchTerm)}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro da API:', errorData);
      return [];
    }

    return await response.json() as User[];
  } catch (error) {
    console.error('Falha ao buscar usuários na API:', error);
    return [];
  }
};
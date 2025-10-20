import { User } from '@estante/common-types';

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
    // # atualizado - Adicionado objeto de opções com 'credentials: "include"'
    const response = await fetch(`/api/findFriends?searchTerm=${encodeURIComponent(searchTerm)}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      // # atualizado - Lê o erro como JSON (baseado no seu log)
      const errorData = await response.json(); 
      // # atualizado - Lança o erro para ser pego pelo NewConversationModal
      throw new Error(errorData.error || `Erro da API: ${response.statusText}`);
    }

    return await response.json() as User[];
  } catch (error) {
    console.error('Falha ao buscar usuários na API:', error);
    // # atualizado - Repassa o erro para o NewConversationModal
    // para que o toastErrorClickable possa mostrá-lo.
    throw error;
  }
};
import { apiClient } from '@/services/api/apiClient';

/**
 * GET /api/users/:userId
 * Retorna dados públicos do perfil de um usuário
 * Retorna 403 se o usuário solicitante foi bloqueado pelo perfil alvo
 */
export const getUserProfileAPI = async (userId: string) => {
    try {
        const res = await apiClient<any>(`/users/${userId}`);
        return res.data || res;
    } catch (error: any) {
        // Adaptar erro do apiClient para o formato esperado pelo loader (com propriedade response)
        // O apiClient já coloca error.status
        if (error.status) {
            error.response = { status: error.status };
        }
        throw error;
    }
};

import { getUserProfileAPI } from '@/services/usersApi';
import { User } from '@estante/common-types';

/**
 * Query para buscar perfil de usuário via API protegida
 * Esta query usa o endpoint /api/users/:userId que verifica bloqueio
 * Retorna 403 se o usuário foi bloqueado, evitando vazamento de dados
 */
export const userProfileQuery = (userId: string) => ({
    queryKey: ['userProfile', userId],
    queryFn: async (): Promise<User> => {
        const data = await getUserProfileAPI(userId);
        return data;
    },
    retry: false, // Não tentar novamente em caso de erro 403
    staleTime: 1000 * 60 * 5, // 5 minutos
});

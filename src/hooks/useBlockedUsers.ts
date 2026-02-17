import { useQuery } from '@tanstack/react-query';
import { listBlockedUsersAPI } from '@/services/friendshipsApi';

/**
 * Hook para buscar e gerenciar lista de usuários bloqueados
 */
export const useBlockedUsers = () => {
    const { data: blockedUsers = [], isLoading, error } = useQuery({
        queryKey: ['blockedUsers'],
        queryFn: listBlockedUsersAPI,
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: true,
    });

    /**
     * Verifica se um usuário específico está bloqueado
     */
    const isUserBlocked = (userId: string): boolean => {
        return blockedUsers.some(user => user.id === userId);
    };

    /**
     * Retorna informações anônimas para usuário bloqueado
     */
    const getAnonymizedUser = (userId: string) => {
        if (isUserBlocked(userId)) {
            return {
                displayName: 'Usuário Bloqueado',
                photoURL: null,
                isBlocked: true,
            };
        }
        return null;
    };

    return {
        blockedUsers,
        isLoading,
        error,
        isUserBlocked,
        getAnonymizedUser,
    };
};

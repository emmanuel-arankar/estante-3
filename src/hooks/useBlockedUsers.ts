import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listBlockedUsersAPI } from '@/services/api/friendshipsApi';

/**
 * Hook para buscar e gerenciar lista de usuários bloqueados.
 * PERFORMANCE:
 * - Pre-computes a Set of blocked user IDs (`blockedUserIdsSet`) with `useMemo` for O(1) constant-time lookups.
 * - Memoizes `isUserBlocked` and `getAnonymizedUser` with `useCallback` to prevent unnecessary re-renders in consumer components.
 */
export const useBlockedUsers = () => {
    const { data: blockedUsers = [], isLoading, error } = useQuery({
        queryKey: ['blockedUsers'],
        queryFn: listBlockedUsersAPI,
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: true,
    });

    // PERFORMANCE: Create O(1) lookup set for blocked user IDs
    const blockedUserIdsSet = useMemo(() => {
        return new Set(blockedUsers.map(user => user.id));
    }, [blockedUsers]);

    /**
     * Verifica se um usuário específico está bloqueado (O(1) lookup)
     */
    const isUserBlocked = useCallback((userId: string): boolean => {
        return blockedUserIdsSet.has(userId);
    }, [blockedUserIdsSet]);

    /**
     * Retorna informações anônimas para usuário bloqueado
     */
    const getAnonymizedUser = useCallback((userId: string) => {
        if (isUserBlocked(userId)) {
            return {
                displayName: 'Usuário Bloqueado',
                photoURL: null,
                isBlocked: true,
            };
        }
        return null;
    }, [isUserBlocked]);

    return {
        blockedUsers,
        isLoading,
        error,
        isUserBlocked,
        getAnonymizedUser,
    };
};

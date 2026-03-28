import { useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
    listNotifications,
    markNotificationAsRead as markAsReadAPI,
    markAllNotificationsAsRead as markAllAsReadAPI,
    getUnreadCount,
} from '@/services/firebase/notifications';
import type { Notification } from '@estante/common-types';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';

const NOTIFICATIONS_PAGE_SIZE = 15;

/**
 * Dispara refetch imediato das notificações.
 * Pode ser chamado de qualquer lugar da aplicação.
 */
export const refreshNotifications = () => {
    window.dispatchEvent(new CustomEvent('notifications:refresh'));
};

// ==== ==== QUERY KEYS ==== ====

const notificationKeys = {
    all: ['notifications'] as const,
    list: (unreadOnly?: boolean) => ['notifications', 'list', { unreadOnly }] as const,
    unreadCount: ['notifications', 'unreadCount'] as const,
};

// ==== ==== HOOK PRINCIPAL ==== ====

export const useNotifications = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // ==================== INFINITE QUERY (Lista Paginada) ====================
    const notificationsQuery = useInfiniteQuery({
        queryKey: notificationKeys.list(false),
        queryFn: async ({ pageParam }) => {
            const response = await listNotifications({
                limit: NOTIFICATIONS_PAGE_SIZE,
                cursor: pageParam as string | undefined,
                unreadOnly: false,
            });
            return response;
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) =>
            lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
        enabled: !!user?.uid,
        staleTime: 1000 * 30, // 30 segundos
        refetchOnWindowFocus: true,
    });

    // ==================== UNREAD COUNT (Query Separada - Polling) ====================
    const unreadQuery = useQuery({
        queryKey: notificationKeys.unreadCount,
        queryFn: getUnreadCount,
        enabled: !!user?.uid,
        refetchInterval: 30_000, // Polling a cada 30 segundos
        refetchOnWindowFocus: true,
        staleTime: 1000 * 15,
    });

    // ==================== DERIVED DATA ====================

    const notifications: Notification[] =
        notificationsQuery.data?.pages.flatMap(page => page.data) || [];

    const unreadCount = unreadQuery.data ?? 0;
    const hasMore = !!notificationsQuery.hasNextPage;
    const isLoadingMore = notificationsQuery.isFetchingNextPage;

    // ==================== ACTIONS ====================

    const loadMore = useCallback(async () => {
        if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            await notificationsQuery.fetchNextPage();
        }
    }, [notificationsQuery]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await markAsReadAPI(notificationId);

            // Optimistic update na lista
            queryClient.setQueriesData(
                { queryKey: notificationKeys.list(false) },
                (old: any) => {
                    if (!old?.pages) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            data: page.data.map((n: Notification) =>
                                n.id === notificationId ? { ...n, read: true } : n
                            ),
                        })),
                    };
                }
            );

            // Decrementar unread count
            queryClient.setQueryData(notificationKeys.unreadCount, (old: number | undefined) =>
                Math.max(0, (old ?? 1) - 1)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }, [queryClient]);

    const markAllAsRead = useCallback(async () => {
        try {
            const result = await markAllAsReadAPI();

            // Optimistic update: marcar todas como lidas
            queryClient.setQueriesData(
                { queryKey: notificationKeys.list(false) },
                (old: any) => {
                    if (!old?.pages) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            data: page.data.map((n: Notification) => ({ ...n, read: true })),
                        })),
                    };
                }
            );

            // Zerar unread count
            queryClient.setQueryData(notificationKeys.unreadCount, 0);

            return result;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }, [queryClient]);

    const refetch = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        ]);
    }, [queryClient]);

    // ==================== REFRESH EVENT LISTENER ====================
    // Escutar evento de refresh imediato (disparado por ações de amizade)
    useEffect(() => {
        const handleRefresh = () => {
            setTimeout(() => refetch(), 500);
        };
        window.addEventListener('notifications:refresh', handleRefresh);
        return () => window.removeEventListener('notifications:refresh', handleRefresh);
    }, [refetch]);

    return {
        notifications,
        unreadCount,
        isLoading: notificationsQuery.isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        markAsRead,
        markAllAsRead,
        refetch,
    };
};

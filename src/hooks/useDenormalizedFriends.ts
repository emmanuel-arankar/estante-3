import { useState, useEffect, useMemo } from 'react';


import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { useCrossTabSync } from '@/hooks/useCrossTabSync';
import { invalidateMutualFriendsCache } from '@/hooks/useMutualFriendsCache';
import { refreshNotifications } from '@/hooks/useNotifications';
import {
  listFriendsAPI,
  listRequestsAPI,
  listSentRequestsAPI,
  sendFriendRequestAPI,
  acceptFriendRequestAPI,
  removeFriendshipAPI,
  bulkAcceptAPI,
  bulkRejectAPI,
  bulkCancelAPI,
  getFriendshipStatusAPI,
  getUserStatsAPI,
  ListFriendsParams,
} from '@/services/api/friendshipsApi';
import type {
  UseFriendsResult,
  FriendshipActions
} from '@/hooks/types/friendship.types';
import {
  SortOption,
  SortDirection,
  FriendshipStats
} from '@estante/common-types';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

const PAGE_SIZE = 100;

/**
 * Atualiza mutualFriendsCount no cache do React Query para todos os amigos afetados
 * Usado após aceitar/remover amizades para sincronizar INSTANTANE AMENTE o cache
 * 
 * @param queryClient - Inst ância do QueryClient
 * @param userId - ID do usuário que aceitou/removeu
 * @param friendId - ID do amigo aceito/removido
 * @param increment - +1 para aceitar, -1 para remover
 */
const updateMutualFriendsCountInCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  friendId: string,
  increment: number
): void => {
  queryClient.setQueriesData(
    { queryKey: ['friends', 'list'] },
    (old: any) => {
      if (!old || !old.pages) return old;

      // Atualizar todas as páginas do infinite query
      const newPages = old.pages.map((page: any) => {
        if (!page || !page.data) return page;

        return {
          ...page,
          data: page.data.map((friendship: any) => {
            // Atualizar amizades que compartilham amigos em comum
            // Exemplo: se userId (você) e friendId (João) viraram amigos,
            // então suas amizades com Maria agora têm +1 mutual friend
            const shouldUpdate =
              // Suas amizades (exceto a nova com friendId)
              (friendship.userId === userId && friendship.friendId !== friendId) ||
              // Amizades do novo amigo (exceto a nova com você)
              (friendship.userId === friendId && friendship.friendId !== userId);

            if (shouldUpdate) {
              const currentCount = friendship.mutualFriendsCount || 0;
              const newCount = Math.max(0, currentCount + increment);

              return {
                ...friendship,
                mutualFriendsCount: newCount
              };
            }

            return friendship;
          })
        };
      });

      return { ...old, pages: newPages };
    }
  );
};

/**
 * Hook principal para gerenciar amizades via API backend usando React Query
 * - Caching via React Query (evita loading ao trocar abas)
 * - useInfiniteQuery para lista de amigos (scroll infinito)
 * - useMutation com Optimistic Updates para ações instantâneas
 * - Listener apenas no user doc para contadores (badges)
 */
export const useDenormalizedFriends = (): UseFriendsResult & FriendshipActions => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { broadcast } = useCrossTabSync(); // ✅ Cross-tab sync

  // Estados de UI
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<SortOption>('friendshipDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [userStats, setUserStats] = useState<FriendshipStats>({
    totalFriends: 0,
    pendingRequests: 0,
    sentRequests: 0
  });

  // ✨ NOVO: Estados otimistas para feedback visual por ação
  const [optimisticActions, setOptimisticActions] = useState<{
    [friendshipId: string]: 'accepting' | 'rejecting' | 'removing' | 'canceling' | null
  }>({});

  // Helper para setar ação otimista
  const setOptimisticAction = (id: string, action: 'accepting' | 'rejecting' | 'removing' | 'canceling' | null) => {
    setOptimisticActions(prev => ({ ...prev, [id]: action }));
  };

  // Helper para limpar ação otimista
  const clearOptimisticAction = (id: string) => {
    setOptimisticActions(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  // Debounce da busca (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ==================== QUERY KEYS ====================
  const queryKeys = {
    friends: (params: ListFriendsParams) => ['friends', 'list', user?.uid, params],
    requests: ['friends', 'requests', user?.uid],
    sentRequests: ['friends', 'sent', user?.uid],
  };

  // ==================== LISTENER DE CONTADORES (Polling) ====================
  // Substituímos o onSnapshot por polling para evitar leitura direta do Firestore no frontend
  const { data: currentStats } = useQuery({
    queryKey: ['userStats', user?.uid],
    queryFn: getUserStatsAPI,
    enabled: !!user?.uid,
    refetchInterval: 1000 * 60, // Polling a cada 1 minuto (ajuste conforme necessidade)
    refetchOnWindowFocus: true,
    staleTime: 1000 * 30,
  });

  // Effect para sincronizar stats e invalidar queries se houver mudança externa
  useEffect(() => {
    if (!currentStats) return;

    setUserStats(prev => {
      // Se nada mudou, retorna o mesmo objeto para evitar re-renders
      if (
        prev.totalFriends === currentStats.totalFriends &&
        prev.pendingRequests === currentStats.pendingRequests &&
        prev.sentRequests === currentStats.sentRequests
      ) {
        return prev;
      }

      // Se mudou, atualiza e invalida as listas pertinentes
      if (currentStats.totalFriends !== prev.totalFriends) {
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'] });
      }
      if (currentStats.pendingRequests !== prev.pendingRequests) {
        queryClient.invalidateQueries({ queryKey: ['friends', 'requests'] });
      }
      if (currentStats.sentRequests !== prev.sentRequests) {
        queryClient.invalidateQueries({ queryKey: ['friends', 'sent'] });
      }

      return currentStats;
    });
  }, [currentStats, queryClient]);

  // ==================== FETCHING QUERIES (Paginação com Cursor) ====================

  // 1. Amigos (Infinite Query)
  const friendsQuery = useInfiniteQuery({
    queryKey: queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }),
    queryFn: ({ pageParam }) =>
      listFriendsAPI({
        limit: PAGE_SIZE,
        sortBy: sortField === 'default' ? 'friendshipDate' : sortField as any,
        sortDirection,
        search: debouncedSearch,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.pagination.nextCursor,
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5, // 5 minutos (agora confiamos na invalidação inteligente)
  });

  // 2. Solicitações Recebidas (Query Simples por enquanto, mas com suporte a cursor na API)
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests,
    queryFn: () => listRequestsAPI({ limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Solicitações Enviadas
  const sentRequestsQuery = useQuery({
    queryKey: queryKeys.sentRequests,
    queryFn: () => listSentRequestsAPI({ limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: 1000 * 60 * 5,
  });

  // ==================== PROCESSAMENTO DE DADOS ====================

  const allFriends = useMemo(() =>
    friendsQuery.data?.pages.flatMap(page => page.data) || [],
    [friendsQuery.data]
  );

  const requests = useMemo(() => requestsQuery.data?.data || [], [requestsQuery.data]);
  const sentRequests = useMemo(() => sentRequestsQuery.data?.data || [], [sentRequestsQuery.data]);

  // ==================== MUTATIONS COM OPTIMISTIC UPDATES ====================

  const acceptMutation = useMutation({
    mutationKey: ['acceptFriend'],
    mutationFn: (friendshipId: string) => {
      setOptimisticAction(friendshipId, 'accepting'); // ✨ Feedback visual instantâneo
      return acceptFriendRequestAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.requests });
      await queryClient.cancelQueries({ queryKey: queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }) });

      const previousRequests = queryClient.getQueryData(queryKeys.requests);
      const previousFriendsPages = queryClient.getQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }));

      const acceptedRequest = requests.find(r => r.id === friendshipId);

      if (acceptedRequest) {
        // Remove das solicitações
        queryClient.setQueryData(queryKeys.requests, (old: any) => {
          if (!old || !old.data) return old;
          return {
            ...old,
            data: old.data.filter((r: any) => r.id !== friendshipId)
          };
        });

        // Adiciona aos amigos (simplificado para o optimistic UI)
        queryClient.setQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }), (old: any) => {
          if (!old) return old;
          const newPages = [...old.pages];

          // ✨ Cria objeto otimista com status e data corretos para aparecer imediatamente na lista
          const optimisticFriend = {
            ...acceptedRequest,
            status: 'accepted',
            friendshipDate: new Date(),
            updatedAt: new Date()
          };

          newPages[0] = {
            ...newPages[0],
            data: [optimisticFriend, ...newPages[0].data]
          };
          return { ...old, pages: newPages };
        });
      }

      return { previousRequests, previousFriendsPages, acceptedRequest };
    },
    onError: (err: any, _id, context) => {
      console.error('[acceptMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.requests, context?.previousRequests);
      queryClient.setQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }), context?.previousFriendsPages);
      toastErrorClickable(`Erro ao aceitar: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async (_, friendshipId, context) => {
      // Get friend name from context (captured in onMutate before optimistic update)
      const friendName = context?.acceptedRequest?.friend.displayName || 'essa pessoa';

      toastSuccessClickable(`Agora você e ${friendName} são amigos!`);

      const [userId, friendId] = friendshipId.split('_');

      // ✅ SOLUÇÃO #3 (HÍBRIDA): Update Manual do Cache + Invalidação Agressiva
      // 1. Atualizar mutualFriendsCount no cache (instantâneo, fix bug #3)
      updateMutualFriendsCountInCache(queryClient, userId, friendId, +1);

      // 2. Invalidar TODAS as queries relacionadas (não só as ativas)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['friends', 'list'],
          refetchType: 'all' // Refetch TODAS as queries (fix bug #1)
        }),
        queryClient.invalidateQueries({
          queryKey: ['friends', 'requests'],
          refetchType: 'all'
        }),
        queryClient.invalidateQueries({
          queryKey: ['friends', 'sent'],
          refetchType: 'all' // Fix bug #2: invalidar sentRequests
        }),
        queryClient.invalidateQueries({
          queryKey: ['friendshipStatus', friendId]
        }),
        queryClient.invalidateQueries({
          queryKey: ['userStats', user?.uid]
        }),
      ]);

      // 3. Invalidar cache de amigos em comum (fix bug #1: mutual friends não aparecem)
      invalidateMutualFriendsCache(userId);
      invalidateMutualFriendsCache(friendId);
      invalidateMutualFriendsCache(); // Invalidar cache global também

      // 4. ✅ Notificar outras abas (cross-tab sync)
      broadcast('friend_request_accepted', { friendshipId, userId, friendId });

      // Atualizar notificações imediatamente
      refreshNotifications();
    },
    onSettled: (_, __, friendshipId) => {
      clearOptimisticAction(friendshipId); // ✨ Limpar estado otimista
    }
  });

  const rejectMutation = useMutation({
    mutationKey: ['rejectFriend'],
    mutationFn: (friendshipId: string) => {
      setOptimisticAction(friendshipId, 'rejecting'); // ✨ Feedback visual instantâneo
      return removeFriendshipAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.requests });
      const previousRequests = queryClient.getQueryData(queryKeys.requests);

      queryClient.setQueryData(queryKeys.requests, (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((r: any) => r.id !== friendshipId)
        };
      });

      return { previousRequests };
    },
    onError: (err: any, _id, context) => {
      console.error('[rejectMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.requests, context?.previousRequests);
      toastErrorClickable(`Erro ao recusar: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async (_, friendshipId) => {
      toastSuccessClickable('Solicitação rejeitada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      const [, friendId] = friendshipId.split('_');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'requests'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friendshipStatus', friendId] }),
        queryClient.invalidateQueries({ queryKey: ['userStats', user?.uid] }),
      ]);

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('friend_request_rejected', { friendshipId });
    },
    onSettled: (_, __, friendshipId) => {
      clearOptimisticAction(friendshipId); // ✨ Limpar estado otimista
    }
  });

  const removeMutation = useMutation({
    mutationKey: ['removeFriend'],
    mutationFn: (friendshipId: string) => {
      setOptimisticAction(friendshipId, 'removing'); // ✨ Feedback visual instantâneo
      return removeFriendshipAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }) });
      const previousFriends = queryClient.getQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }));

      // Capture friend data before optimistic update removes it
      const removedFriend = allFriends.find(f => f.id === friendshipId);

      queryClient.setQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((f: any) => f.id !== friendshipId)
          }))
        };
      });

      return { previousFriends, removedFriend };
    },
    onError: (err: any, _id, context) => {
      console.error('[removeMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }), context?.previousFriends);
      toastErrorClickable(`Erro ao remover: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async (_, friendshipId, context) => {
      // Get friend name from context (captured in onMutate before optimistic update)
      const friendName = context?.removedFriend?.friend.displayName || 'Essa pessoa';

      toastSuccessClickable(`${friendName} foi removido dos seus amigos`);

      const [userId, friendId] = friendshipId.split('_');

      // ✅ SOLUÇÃO #3: Update Manual do Cache + Invalidação
      // 1. Atualizar mutualFriendsCount no cache (instantâneo, fix bug #6)
      updateMutualFriendsCountInCache(queryClient, userId, friendId, -1);

      // 2. ✅ REMOVER amigo de TODOS os caches antes de invalidar (fix bug #7)
      //    Isso previne race condition onde refetch traz dados antigos do Firestore
      queryClient.setQueriesData(
        { queryKey: ['friends', 'list'] },
        (old: any) => {
          if (!old || !old.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              data: page.data ? page.data.filter((f: any) => f.id !== friendshipId) : []
            }))
          };
        }
      );

      // 3. Invalidar todas as queries + cache de mutual friends
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'requests'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'sent'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friendshipStatus', friendId] }),
        queryClient.invalidateQueries({ queryKey: ['userStats', user?.uid] }),
      ]);

      // 3. Invalidar cache de amigos em comum (recalcular após remover amizade)
      invalidateMutualFriendsCache(userId);
      invalidateMutualFriendsCache(friendId);
      invalidateMutualFriendsCache();

      // 4. ✅ Notificar outras abas (cross-tab sync)
      broadcast('friend_removed', { friendshipId, userId, friendId });
    },
    onSettled: (_, __, friendshipId) => {
      clearOptimisticAction(friendshipId); // ✨ Limpar estado otimista
    }
  });

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequestAPI,
    onSuccess: (_, targetUserId) => {
      toastSuccessClickable('Solicitação de amizade enviada!');
      queryClient.invalidateQueries({ queryKey: queryKeys.sentRequests });
      queryClient.invalidateQueries({ queryKey: ['friendshipStatus', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.uid] });

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('friend_request_sent', { friendshipId: `${user?.uid}_${targetUserId}` });

      // Atualizar notificações do destinatário (no caso de mesma sessão)
      refreshNotifications();
    },
    onError: () => toastErrorClickable('Erro ao enviar solicitação de amizade')
  });

  const cancelSentMutation = useMutation({
    mutationKey: ['cancelSentRequest'],
    mutationFn: (friendshipId: string) => {
      setOptimisticAction(friendshipId, 'canceling'); // ✨ Feedback visual instantâneo
      return removeFriendshipAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sentRequests });
      const previousSent = queryClient.getQueryData(queryKeys.sentRequests);

      queryClient.setQueryData(queryKeys.sentRequests, (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((s: any) => s.id !== friendshipId)
        };
      });

      return { previousSent };
    },
    onError: (err: any, _id, context) => {
      console.error('[cancelSentMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.sentRequests, context?.previousSent);
      toastErrorClickable(`Erro ao cancelar: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async (_, friendshipId) => {
      toastSuccessClickable('Solicitação cancelada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      const [, friendId] = friendshipId.split('_');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'sent'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friendshipStatus', friendId] }),
        queryClient.invalidateQueries({ queryKey: ['userStats', user?.uid] }),
      ]);

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('sent_request_cancelled', { friendshipId });
    },
    onSettled: (_, __, friendshipId) => {
      clearOptimisticAction(friendshipId); // ✨ Limpar estado otimista
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, friendIds }: { action: 'accept' | 'reject' | 'cancel', friendIds: string[] }) => {
      if (action === 'accept') return bulkAcceptAPI(friendIds);
      if (action === 'reject') return bulkRejectAPI(friendIds);
      return bulkCancelAPI(friendIds);
    },
    onSuccess: (_, params) => {
      const { action, friendIds } = params;
      const count = friendIds.length;

      let message = '';
      if (action === 'accept') {
        message = count === 1
          ? '1 solicitação aceita!'
          : `${count} solicitações aceitas!`;
      } else if (action === 'reject') {
        message = count === 1
          ? '1 solicitação rejeitada'
          : `${count} solicitações rejeitadas`;
      } else if (action === 'cancel') {
        message = count === 1
          ? '1 solicitação cancelada'
          : `${count} solicitações canceladas`;
      }

      toastSuccessClickable(message);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.uid] });
    },
    onError: (err: any) => {
      console.error('[bulkMutation] Erro:', err);
      toastErrorClickable(`Erro em lote: ${err?.message || 'Erro desconhecido'}`);
    }
  });

  // ==================== FILTRAGEM LOCAL PARA REQUESTS ====================
  // Requests e SentRequests são listas menores, filtramos localmente para UX instantâneo com a barra de busca
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const lower = searchQuery.toLowerCase();
    return requests.filter(r =>
      r.friend.displayName.toLowerCase().includes(lower) ||
      r.friend.nickname.toLowerCase().includes(lower)
    );
  }, [requests, searchQuery]);

  const filteredSentRequests = useMemo(() => {
    if (!searchQuery.trim()) return sentRequests;
    const lower = searchQuery.toLowerCase();
    return sentRequests.filter(s =>
      s.friend.displayName.toLowerCase().includes(lower) ||
      s.friend.nickname.toLowerCase().includes(lower)
    );
  }, [sentRequests, searchQuery]);

  // ==================== RETORNO ====================

  return {
    friends: allFriends,
    allFriends,
    requests: filteredRequests,
    sentRequests: filteredSentRequests,
    stats: userStats,
    loading: (friendsQuery.isLoading && !friendsQuery.isPaused) || requestsQuery.isLoading || sentRequestsQuery.isLoading,
    loadingMore: friendsQuery.isFetchingNextPage,
    error: (friendsQuery.error as any)?.message || (requestsQuery.error as any)?.message || (sentRequestsQuery.error as any)?.message || null,
    hasMoreFriends: !!friendsQuery.hasNextPage,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    loadAllFriends: async () => { await friendsQuery.refetch(); },
    loadMoreFriends: async () => { await friendsQuery.fetchNextPage(); },
    refreshData: async () => {
      await Promise.all([
        friendsQuery.refetch(),
        requestsQuery.refetch(),
        sentRequestsQuery.refetch()
      ]);
    },
    sendFriendRequest: sendRequestMutation.mutateAsync,
    acceptFriendRequest: acceptMutation.mutateAsync,
    rejectFriendRequest: rejectMutation.mutateAsync,
    removeFriend: removeMutation.mutateAsync,
    cancelSentRequest: cancelSentMutation.mutateAsync,
    cancelAllSentRequests: async () => { await bulkMutation.mutateAsync({ action: 'cancel', friendIds: sentRequests.map(s => s.friendId) }); },
    acceptAllRequests: async () => { await bulkMutation.mutateAsync({ action: 'accept', friendIds: requests.map(r => r.friendId) }); },
    rejectAllRequests: async () => { await bulkMutation.mutateAsync({ action: 'reject', friendIds: requests.map(r => r.friendId) }); },
    // ✨ NOVO: Helpers para verificar estados otimistas
    isAccepting: (id: string) => optimisticActions[id] === 'accepting',
    isRejecting: (id: string) => optimisticActions[id] === 'rejecting',
    isRemoving: (id: string) => optimisticActions[id] === 'removing',
    isCanceling: (id: string) => optimisticActions[id] === 'canceling',
  };
};

export const useFriendshipStats = () => {
  const { stats, loading } = useDenormalizedFriends();
  return { stats, loading };
};

export const useFriendshipStatus = (targetUserId: string) => {
  const { user } = useAuth();

  const { data: status, isLoading } = useQuery({
    queryKey: ['friendshipStatus', targetUserId],
    queryFn: () => getFriendshipStatusAPI(targetUserId),
    enabled: !!user && !!targetUserId && user.uid !== targetUserId,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache (invalidado nas ações)
  });

  if (user?.uid === targetUserId) {
    return { status: 'self', loading: false };
  }

  return { status: status || 'none', loading: isLoading };
};

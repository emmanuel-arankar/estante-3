import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { invalidateMutualFriendsCache } from '@/hooks/useMutualFriendsCache';
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
  ListFriendsParams,
} from '@/services/friendshipsApi';
import type {
  UseFriendsResult,
  FriendshipActions,
  SortOption,
  SortDirection
} from '@/hooks/types/friendship.types';
import {
  DenormalizedFriendship,
  FriendshipStats,
} from '@estante/common-types';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

const PAGE_SIZE = 100;
const STALE_TIME = 5 * 60 * 1000; // 5 minutos

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

  // ==================== LISTENER DE CONTADORES (user doc) ====================
  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserStats({
          totalFriends: data.friendsCount ?? 0,
          pendingRequests: data.pendingRequestsCount ?? 0,
          sentRequests: data.sentRequestsCount ?? 0
        });
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  // ==================== FETCHING QUERIES ====================

  // 1. Amigos (Infinite Query) - usa debouncedSearch
  const friendsQuery = useInfiniteQuery({
    queryKey: queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }),
    queryFn: ({ pageParam = 1 }) =>
      listFriendsAPI({
        page: pageParam,
        limit: PAGE_SIZE,
        sortBy: sortField === 'default' ? 'friendshipDate' : sortField as any,
        sortDirection,
        search: debouncedSearch
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: !!user?.uid,
    staleTime: STALE_TIME,
  });

  // 2. Solicitações Recebidas
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests,
    queryFn: () => listRequestsAPI({ page: 1, limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true, // ✅ Fix bug #5: refetch ao voltar para aba
  });

  // 3. Solicitações Enviadas
  const sentRequestsQuery = useQuery({
    queryKey: queryKeys.sentRequests,
    queryFn: () => listSentRequestsAPI({ page: 1, limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true, // ✅ Fix bug #5: refetch ao voltar para aba
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
    mutationFn: (friendshipId: string) => {
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
        queryClient.setQueryData(queryKeys.requests, (old: any) => ({
          ...old,
          data: old.data.filter((r: any) => r.id !== friendshipId)
        }));

        // Adiciona aos amigos (simplificado para o optimistic UI)
        queryClient.setQueryData(queryKeys.friends({ sortBy: sortField as any, sortDirection, search: debouncedSearch }), (old: any) => {
          if (!old) return old;
          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [acceptedRequest, ...newPages[0].data]
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
      ]);

      // 3. Invalidar cache de amigos em comum (fix bug #1: mutual friends não aparecem)
      invalidateMutualFriendsCache(userId);
      invalidateMutualFriendsCache(friendId);
      invalidateMutualFriendsCache(); // Invalidar cache global também
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (friendshipId: string) => {
      return removeFriendshipAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.requests });
      const previousRequests = queryClient.getQueryData(queryKeys.requests);

      queryClient.setQueryData(queryKeys.requests, (old: any) => ({
        ...old,
        data: old.data.filter((r: any) => r.id !== friendshipId)
      }));

      return { previousRequests };
    },
    onError: (err: any, _id, context) => {
      console.error('[rejectMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.requests, context?.previousRequests);
      toastErrorClickable(`Erro ao recusar: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async () => {
      toastSuccessClickable('Solicitação rejeitada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'requests'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
      ]);
    }
  });

  const removeMutation = useMutation({
    mutationFn: (friendshipId: string) => {
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
      ]);

      // 3. Invalidar cache de amigos em comum (recalcular após remover amizade)
      invalidateMutualFriendsCache(userId);
      invalidateMutualFriendsCache(friendId);
      invalidateMutualFriendsCache();
    }
  });

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequestAPI,
    onSuccess: () => {
      toastSuccessClickable('Solicitação de amizade enviada!');
      queryClient.invalidateQueries({ queryKey: queryKeys.sentRequests });
    },
    onError: () => toastErrorClickable('Erro ao enviar solicitação de amizade')
  });

  const cancelSentMutation = useMutation({
    mutationFn: (friendshipId: string) => {
      return removeFriendshipAPI(friendshipId);
    },
    onMutate: async (friendshipId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sentRequests });
      const previousSent = queryClient.getQueryData(queryKeys.sentRequests);

      queryClient.setQueryData(queryKeys.sentRequests, (old: any) => ({
        ...old,
        data: old.data.filter((s: any) => s.id !== friendshipId)
      }));

      return { previousSent };
    },
    onError: (err: any, _id, context) => {
      console.error('[cancelSentMutation] Erro:', err);
      queryClient.setQueryData(queryKeys.sentRequests, context?.previousSent);
      toastErrorClickable(`Erro ao cancelar: ${err?.message || 'Erro desconhecido'}`);
    },
    onSuccess: async () => {
      toastSuccessClickable('Solicitação cancelada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'sent'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
      ]);
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
  };
};

export const useFriendshipStats = () => {
  const { stats, loading } = useDenormalizedFriends();
  return { stats, loading };
};

export const useFriendshipStatus = (targetUserId: string) => {
  const { friends, requests, sentRequests, loading } = useDenormalizedFriends();

  const status = (() => {
    if (friends.some(f => f.friendId === targetUserId)) return 'friends';
    if (requests.some(r => r.friendId === targetUserId)) return 'request_received';
    if (sentRequests.some(s => s.friendId === targetUserId)) return 'request_sent';
    return 'none';
  })();

  return { status, loading };
};

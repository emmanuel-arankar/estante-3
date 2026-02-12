import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, query, collection, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { useCrossTabSync } from '@/hooks/useCrossTabSync';
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

  // ==================== FIRESTORE REALTIME LISTENERS ====================
  // ✅ SOLUÇÃO: Listeners em tempo real para sincronização instantânea entre clientes

  // 1️⃣ Listener para AMIGOS (status: accepted)
  useEffect(() => {
    if (!user?.uid) return;

    const friendsRef = query(
      collection(db, 'friendships'),
      where('userId', '==', user.uid),
      where('status', '==', 'accepted'),
      orderBy('friendshipDate', 'desc')
    );

    const unsubscribe = onSnapshot(friendsRef, (snapshot) => {
      // ✅ Checar se há mutations ativas que podem conflitar
      const isAccepting = queryClient.isMutating({ mutationKey: ['acceptFriend'] }) > 0;
      const isRemoving = queryClient.isMutating({ mutationKey: ['removeFriend'] }) > 0;

      // Só atualiza cache se não há mutations ativas (evita sobrescrever optimistic updates)
      if (isAccepting || isRemoving) {
        console.log('[Friends Listener] Skipping update - mutation in progress');
        return;
      }

      const friendsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          friendId: data.friendId,
          status: data.status,
          requestedBy: data.requestedBy,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          friendshipDate: data.friendshipDate instanceof Timestamp ? data.friendshipDate.toDate() : new Date(data.friendshipDate),
          friend: {
            id: data.friend?.id || data.friendId,
            displayName: data.friend?.displayName || '',
            nickname: data.friend?.nickname || '',
            photoURL: data.friend?.photoURL || undefined,
            email: data.friend?.email || '',
            bio: data.friend?.bio || '',
            location: data.friend?.location || '',
            joinedAt: data.friend?.joinedAt instanceof Timestamp ? data.friend.joinedAt.toDate() : new Date(),
            lastActive: data.friend?.lastActive instanceof Timestamp ? data.friend.lastActive.toDate() : undefined,
          },
          mutualFriendsCount: data.mutualFriendsCount || 0,
        };
      });

      // ✅ Atualizar cache do React Query preservando estrutura de paginação
      queryClient.setQueriesData(
        { queryKey: ['friends', 'list', user.uid] },
        (old: any) => {
          if (!old || !old.pages) {
            // Primeira carga - criar estrutura inicial
            return {
              pages: [{
                data: friendsData,
                pagination: {
                  page: 1,
                  limit: PAGE_SIZE,
                  total: friendsData.length,
                  totalPages: Math.ceil(friendsData.length / PAGE_SIZE),
                  hasMore: false,
                }
              }],
              pageParams: [1]
            };
          }

          // ✅ FIX: Atualizar apenas os dados nas páginas existentes, não reestruturar
          // Criar um Map para lookup rápido dos novos dados
          const friendsMap = new Map(friendsData.map(f => [f.id, f]));

          const updatedPages = old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((friend: any) => {
              // Se o amigo existe nos novos dados, atualizar
              const updated = friendsMap.get(friend.id);
              return updated || friend;
            }).filter((friend: any) => {
              // Remover amigos que não existem mais nos dados do listener
              return friendsMap.has(friend.id);
            })
          }));

          return { ...old, pages: updatedPages };
        }
      );
    });

    return unsubscribe;
  }, [user?.uid, queryClient]);

  // 2️⃣ Listener para SOLICITAÇÕES RECEBIDAS (status: pending, requestedBy !== userId)
  useEffect(() => {
    if (!user?.uid) return;

    const requestsRef = query(
      collection(db, 'friendships'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      // ✅ Checar se há mutations ativas que podem conflitar
      const isAccepting = queryClient.isMutating({ mutationKey: ['acceptFriend'] }) > 0;
      const isRejecting = queryClient.isMutating({ mutationKey: ['rejectFriend'] }) > 0;

      // Só atualiza cache se não há mutations ativas (evita sobrescrever optimistic updates)
      if (isAccepting || isRejecting) {
        console.log('[Requests Listener] Skipping update - mutation in progress');
        return;
      }

      // Filtrar apenas solicitações onde requestedBy !== userId (recebidas)
      const requestsData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            friendId: data.friendId,
            status: data.status,
            requestedBy: data.requestedBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
            friendshipDate: data.friendshipDate instanceof Timestamp ? data.friendshipDate.toDate() : undefined,
            friend: {
              id: data.friend?.id || data.friendId,
              displayName: data.friend?.displayName || '',
              nickname: data.friend?.nickname || '',
              photoURL: data.friend?.photoURL || undefined,
              email: data.friend?.email || '',
              bio: data.friend?.bio || '',
              location: data.friend?.location || '',
              joinedAt: data.friend?.joinedAt instanceof Timestamp ? data.friend.joinedAt.toDate() : new Date(),
              lastActive: data.friend?.lastActive instanceof Timestamp ? data.friend.lastActive.toDate() : undefined,
            },
            mutualFriendsCount: data.mutualFriendsCount || 0,
          };
        })
        .filter(req => req.requestedBy !== user.uid); // ✅ Filtrar apenas recebidas

      // ✅ Atualizar cache do React Query
      queryClient.setQueryData(queryKeys.requests, {
        data: requestsData,
        pagination: {
          page: 1,
          limit: PAGE_SIZE,
          total: requestsData.length,
          totalPages: Math.ceil(requestsData.length / PAGE_SIZE),
          hasMore: false,
        }
      });
    });

    return unsubscribe;
  }, [user?.uid, queryClient, queryKeys.requests]);

  // 3️⃣ Listener para SOLICITAÇÕES ENVIADAS (status: pending, requestedBy === userId)
  useEffect(() => {
    if (!user?.uid) return;

    const sentRef = query(
      collection(db, 'friendships'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(sentRef, (snapshot) => {
      // ✅ Checar se há mutations ativas que podem conflitar
      const isCanceling = queryClient.isMutating({ mutationKey: ['cancelSentRequest'] }) > 0;

      // Só atualiza cache se não há mutations ativas (evita sobrescrever optimistic updates)
      if (isCanceling) {
        console.log('[Sent Requests Listener] Skipping update - mutation in progress');
        return;
      }

      // Filtrar apenas solicitações onde requestedBy === userId (enviadas)
      const sentData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            friendId: data.friendId,
            status: data.status,
            requestedBy: data.requestedBy,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
            friendshipDate: data.friendshipDate instanceof Timestamp ? data.friendshipDate.toDate() : undefined,
            friend: {
              id: data.friend?.id || data.friendId,
              displayName: data.friend?.displayName || '',
              nickname: data.friend?.nickname || '',
              photoURL: data.friend?.photoURL || undefined,
              email: data.friend?.email || '',
              bio: data.friend?.bio || '',
              location: data.friend?.location || '',
              joinedAt: data.friend?.joinedAt instanceof Timestamp ? data.friend.joinedAt.toDate() : new Date(),
              lastActive: data.friend?.lastActive instanceof Timestamp ? data.friend.lastActive.toDate() : undefined,
            },
            mutualFriendsCount: data.mutualFriendsCount || 0,
          };
        })
        .filter(req => req.requestedBy === user.uid); // ✅ Filtrar apenas enviadas

      // ✅ Atualizar cache do React Query
      queryClient.setQueryData(queryKeys.sentRequests, {
        data: sentData,
        pagination: {
          page: 1,
          limit: PAGE_SIZE,
          total: sentData.length,
          totalPages: Math.ceil(sentData.length / PAGE_SIZE),
          hasMore: false,
        }
      });
    });

    return unsubscribe;
  }, [user?.uid, queryClient, queryKeys.sentRequests]);

  // ==================== FETCHING QUERIES ====================
  // ✅ HÍBRIDO: React Query carrega dados iniciais, Firestore Listeners mantêm sincronizado

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
    staleTime: Infinity, // ✅ Listeners mantêm cache atualizado
  });

  // 2. Solicitações Recebidas
  const requestsQuery = useQuery({
    queryKey: queryKeys.requests,
    queryFn: () => listRequestsAPI({ page: 1, limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: Infinity, // ✅ Listeners mantêm cache atualizado
    refetchOnWindowFocus: false, // ❌ Desabilitado - listeners fazem isso
  });

  // 3. Solicitações Enviadas
  const sentRequestsQuery = useQuery({
    queryKey: queryKeys.sentRequests,
    queryFn: () => listSentRequestsAPI({ page: 1, limit: PAGE_SIZE }),
    enabled: !!user?.uid,
    staleTime: Infinity, // ✅ Listeners mantêm cache atualizado
    refetchOnWindowFocus: false, // ❌ Desabilitado - listeners fazem isso
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

      // 4. ✅ Notificar outras abas (cross-tab sync)
      broadcast('FRIEND_REQUEST_ACCEPTED', { friendshipId, userId, friendId });
    }
  });

  const rejectMutation = useMutation({
    mutationKey: ['rejectFriend'],
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
    onSuccess: async (_, friendshipId) => {
      toastSuccessClickable('Solicitação rejeitada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'requests'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
      ]);

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('FRIEND_REQUEST_REJECTED', { friendshipId });
    }
  });

  const removeMutation = useMutation({
    mutationKey: ['removeFriend'],
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

      // 4. ✅ Notificar outras abas (cross-tab sync)
      broadcast('FRIEND_REMOVED', { friendshipId, userId, friendId });
    }
  });

  const sendRequestMutation = useMutation({
    mutationFn: sendFriendRequestAPI,
    onSuccess: (_, targetUserId) => {
      toastSuccessClickable('Solicitação de amizade enviada!');
      queryClient.invalidateQueries({ queryKey: queryKeys.sentRequests });

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('FRIEND_REQUEST_SENT', { friendshipId: `${user?.uid}_${targetUserId}` });
    },
    onError: () => toastErrorClickable('Erro ao enviar solicitação de amizade')
  });

  const cancelSentMutation = useMutation({
    mutationKey: ['cancelSentRequest'],
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
    onSuccess: async (_, friendshipId) => {
      toastSuccessClickable('Solicitação cancelada');

      // ✅ SOLUÇÃO #3: Invalidar todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', 'sent'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['friends', 'list'], refetchType: 'all' }),
      ]);

      // ✅ Notificar outras abas (cross-tab sync)
      broadcast('SENT_REQUEST_CANCELLED', { friendshipId });
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

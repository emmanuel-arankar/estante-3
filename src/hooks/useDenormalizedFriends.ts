import { useState, useEffect, useCallback, useRef } from 'react';
import { useMemo } from 'react';
import { DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { 
  toastSuccessClickable, 
  toastErrorClickable 
} from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import {
  getDenormalizedFriends,
  getDenormalizedFriendRequests,
  getDenormalizedSentRequests,
  subscribeToDenormalizedFriends,
  subscribeToDenormalizedRequests,
  subscribeToDenormalizedSentRequests,
  sendDenormalizedFriendRequest,
  acceptDenormalizedFriendRequest,
  rejectDenormalizedFriendRequest,
  removeDenormalizedFriend,
  searchFriends
} from '@/services/denormalizedFriendships';
import {
  DenormalizedFriendship,
  FriendshipStats,
  UseFriendsResult,
  FriendshipActions,
  SortOption,
  SortDirection
} from '@estante/common-types';

// ==================== CACHE INTELIGENTE ====================
interface FriendsCache {
  [key: string]: {
    data: DenormalizedFriendship[];
    timestamp: number;
    lastDoc?: DocumentSnapshot;
  };
}

const friendsCache: FriendsCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const getCacheKey = (userId: string, type: string) => `${userId}_${type}`;

const isCacheValid = (timestamp: number) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

/**
 * Hook principal para gerenciar amizades denormalizadas
 * ✅ Carregamento inteligente de TODOS os amigos
 * ✅ Dados completos sem queries extras
 * ✅ Tempo real com onSnapshot
 * ✅ Cache inteligente e virtualização
 * ✅ Busca e ordenação global
 */
export const useDenormalizedFriends = (): UseFriendsResult & FriendshipActions => {
  const { user } = useAuth();

  // Estados
  const [allFriends, setAllFriends] = useState<DenormalizedFriendship[]>([]);
  const [requests, setRequests] = useState<DenormalizedFriendship[]>([]);
  const [sentRequests, setSentRequests] = useState<DenormalizedFriendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortOption>('friendshipDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchedFriends, setSearchedFriends] = useState<DenormalizedFriendship[] | null>(null);
  const [hasMoreFriends, setHasMoreFriends] = useState(true);
  
  const lastFriendDoc = useRef<DocumentSnapshot<DocumentData> | null>(null);
  const unsubscribeFriends = useRef<(() => void) | null>(null);
  const unsubscribeRequests = useRef<(() => void) | null>(null);
  const unsubscribeSentRequests = useRef<(() => void) | null>(null);

  // ==================== BUSCA NO SERVIDOR ====================

  useEffect(() => {
    if (!user?.uid) return;
    const performSearch = async () => {
      if (searchQuery.trim().length > 1) {
        setLoading(true);
        const results = await searchFriends(user.uid, searchQuery);
        setSearchedFriends(results);
        setLoading(false);
      } else {
        setSearchedFriends(null);
      }
    };
    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, user?.uid]);

  // ==================== ORDENAÇÃO ====================

  const sortFriends = useCallback((friendsToSort: DenormalizedFriendship[]) => {
    if (sortField === 'default') {
        return [...friendsToSort].sort((a, b) => {
            const dateA = a.friendshipDate?.getTime() || a.createdAt.getTime();
            const dateB = b.friendshipDate?.getTime() || b.createdAt.getTime();
            return dateB - dateA;
        });
    }
    return [...friendsToSort].sort((a, b) => {
        let valueA: any, valueB: any;
        switch (sortField) {
            case 'name':
                valueA = a.friend.displayName.toLowerCase();
                valueB = b.friend.displayName.toLowerCase();
                break;
            case 'nickname':
                valueA = a.friend.nickname.toLowerCase();
                valueB = b.friend.nickname.toLowerCase();
                break;
            case 'friendshipDate':
                valueA = a.friendshipDate?.getTime() || a.createdAt.getTime();
                valueB = b.friendshipDate?.getTime() || b.createdAt.getTime();
                break;
            default: return 0;
        }
        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
  }, [sortField, sortDirection]);

  // ==================== LISTAS MEMOIZADAS ====================

  const filteredAndSortedFriends = useMemo(() => {
    const source = searchedFriends !== null ? searchedFriends : allFriends;
    return sortFriends(source);
  }, [allFriends, searchedFriends, sortFriends]);

  const filteredAndSortedRequests = useMemo(() => {
    return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [requests]);

  const filteredAndSortedSentRequests = useMemo(() => {
    return sentRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [sentRequests]);

  // ==================== CARREGAMENTO E LISTENERS ====================
  
  const loadAllFriends = useCallback(async (refresh = false) => {
    if (!user?.uid) return;
    const cacheKey = getCacheKey(user.uid, 'friends');
    if (!refresh && friendsCache[cacheKey] && isCacheValid(friendsCache[cacheKey].timestamp)) {
      setAllFriends(friendsCache[cacheKey].data);
      setLoading(false);
      return;
    }
    if (refresh) {
      setAllFriends([]);
      lastFriendDoc.current = null;
      setHasMoreFriends(true);
    }
    setLoading(true);
    setError(null);
    try {
      const allFriendsData: DenormalizedFriendship[] = [];
      let hasMore = true;
      let lastDoc: DocumentSnapshot<DocumentData> | null = lastFriendDoc.current;
      while (hasMore) {
        const result = await getDenormalizedFriends(user.uid, 100, lastDoc || undefined);
        if (result.friends.length > 0) {
          const existingIds = new Set(allFriendsData.map(f => f.id));
          const newFriends = result.friends.filter(f => !existingIds.has(f.id));
          allFriendsData.push(...newFriends);
          lastDoc = result.lastDoc;
          hasMore = result.hasMore && newFriends.length > 0;
        } else {
          hasMore = false;
        }
      }
      setAllFriends(allFriendsData);
      lastFriendDoc.current = lastDoc;
      setHasMoreFriends(hasMore);
      // ✅ CORREÇÃO: Converte `null` em `undefined` ao salvar no cache
      friendsCache[cacheKey] = { data: allFriendsData, timestamp: Date.now(), lastDoc: lastDoc || undefined };
    } catch (err) {
      console.error('Erro ao carregar amigos:', err);
      setError('Erro ao carregar amigos');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);
  
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    unsubscribeFriends.current = subscribeToDenormalizedFriends(user.uid, (friendsData) => { setAllFriends(friendsData); setLoading(false); }, 100);
    unsubscribeRequests.current = subscribeToDenormalizedRequests(user.uid, (requestsData) => { setRequests(requestsData); });
    unsubscribeSentRequests.current = subscribeToDenormalizedSentRequests(user.uid, (sentRequestsData) => { setSentRequests(sentRequestsData); });
    loadAllFriends(true);
    return () => {
      unsubscribeFriends.current?.();
      unsubscribeRequests.current?.();
      unsubscribeSentRequests.current?.();
    };
  }, [user?.uid, loadAllFriends]);

  const loadMoreFriends = useCallback(async () => {
    if (!user?.uid || loadingMore || !hasMoreFriends) return;
    setLoadingMore(true);
    try {
      const result = await getDenormalizedFriends(user.uid, 100, lastFriendDoc.current || undefined);
      if (result.friends.length > 0) {
        const existingIds = new Set(allFriends.map(f => f.id));
        const newFriends = result.friends.filter(f => !existingIds.has(f.id));
        if (newFriends.length > 0) {
          setAllFriends(prev => {
            const updated = [...prev, ...newFriends];
            const cacheKey = getCacheKey(user.uid, 'friends');
            // ✅ CORREÇÃO: Converte `null` em `undefined` ao salvar no cache
            friendsCache[cacheKey] = { data: updated, timestamp: Date.now(), lastDoc: result.lastDoc || undefined };
            return updated;
          });
          lastFriendDoc.current = result.lastDoc || null;
          setHasMoreFriends(result.hasMore);
        } else {
          setHasMoreFriends(false);
        }
      } else {
        setHasMoreFriends(false);
      }
    } catch (err) {
      console.error('Erro ao carregar mais amigos:', err);
      setError('Erro ao carregar mais amigos');
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, loadingMore, hasMoreFriends, allFriends]);

  const refreshData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    lastFriendDoc.current = null;
    setHasMoreFriends(true);
    const cacheKey = getCacheKey(user.uid, 'friends');
    delete friendsCache[cacheKey];
    try {
      const [requestsData, sentRequestsData] = await Promise.all([
        getDenormalizedFriendRequests(user.uid),
        getDenormalizedSentRequests(user.uid)
      ]);
      setRequests(requestsData);
      setSentRequests(sentRequestsData);
      await loadAllFriends(true);
    } catch (err) {
      console.error('Erro ao recarregar dados:', err);
      setError('Erro ao recarregar dados');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, loadAllFriends]);
  
  // ==================== AÇÕES DE AMIZADE ====================

  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    if (!user?.uid) { toastErrorClickable('Você precisa estar logado'); return; }
    try {
      await sendDenormalizedFriendRequest(user.uid, targetUserId);
      toastSuccessClickable('Solicitação de amizade enviada!');
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      toastErrorClickable('Erro ao enviar solicitação de amizade');
      throw err;
    }
  }, [user?.uid]);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    if (!user?.uid) { toastErrorClickable('Você precisa estar logado'); return; }
    const request = requests.find(r => r.id === friendshipId);
    if (!request) { toastErrorClickable('Solicitação não encontrada'); return; }
    try {
      await acceptDenormalizedFriendRequest(user.uid, request.friendId);
      toastSuccessClickable(`Agora você e ${request.friend.displayName} são amigos!`);
      const cacheKey = getCacheKey(user.uid, 'friends');
      delete friendsCache[cacheKey];
    } catch (err) {
      console.error('Erro ao aceitar solicitação:', err);
      toastErrorClickable('Erro ao aceitar solicitação');
      throw err;
    }
  }, [user?.uid, requests]);

  const rejectFriendRequest = useCallback(async (friendshipId: string) => {
    if (!user?.uid) { toastErrorClickable('Você precisa estar logado'); return; }
    const request = requests.find(r => r.id === friendshipId);
    if (!request) { toastErrorClickable('Solicitação não encontrada'); return; }
    try {
      await rejectDenormalizedFriendRequest(user.uid, request.friendId);
      toastSuccessClickable('Solicitação rejeitada');
    } catch (err) {
      console.error('Erro ao rejeitar solicitação:', err);
      toastErrorClickable('Erro ao rejeitar solicitação');
      throw err;
    }
  }, [user?.uid, requests]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    if (!user?.uid) { toastErrorClickable('Você precisa estar logado'); return; }
    const friend = allFriends.find(f => f.id === friendshipId);
    if (!friend) { toastErrorClickable('Amigo não encontrado'); return; }
    try {
      await removeDenormalizedFriend(user.uid, friend.friendId);
      toastSuccessClickable(`${friend.friend.displayName} foi removido dos seus amigos`);
      const cacheKey = getCacheKey(user.uid, 'friends');
      delete friendsCache[cacheKey];
    } catch (err) {
      console.error('Erro ao remover amigo:', err);
      toastErrorClickable('Erro ao remover amigo');
      throw err;
    }
  }, [user?.uid, allFriends]);

  const cancelAllSentRequests = useCallback(async () => {
    if (!user?.uid || sentRequests.length === 0) { toastErrorClickable('Nenhuma solicitação para cancelar'); return; }
    try {
      const deletePromises = sentRequests.map(request => rejectDenormalizedFriendRequest(user.uid, request.friendId));
      await Promise.all(deletePromises);
      toastSuccessClickable(`Todas as solicitações (${sentRequests.length}) foram canceladas`);
    } catch (err) {
      console.error('Erro ao cancelar solicitações:', err);
      toastErrorClickable('Erro ao cancelar solicitações');
      throw err;
    }
  }, [user?.uid, sentRequests]);
  
  const cancelSentRequest = useCallback(async (friendshipId: string) => {
    if (!user?.uid) { toastErrorClickable('Você precisa estar logado'); return; }
    const sentRequest = sentRequests.find(s => s.id === friendshipId);
    if (!sentRequest) { toastErrorClickable('Solicitação não encontrada'); return; }
    try {
      await rejectDenormalizedFriendRequest(user.uid, sentRequest.friendId);
      toastSuccessClickable('Solicitação cancelada');
    } catch (err) {
      console.error('Erro ao cancelar solicitação:', err);
      toastErrorClickable('Erro ao cancelar solicitação');
      throw err;
    }
  }, [user?.uid, sentRequests]);

  // ==================== ESTATÍSTICAS E RETORNO ====================
  
  const stats: FriendshipStats = { totalFriends: allFriends.length, pendingRequests: requests.length, sentRequests: sentRequests.length };
  
  return {
    friends: filteredAndSortedFriends, allFriends, requests: filteredAndSortedRequests, sentRequests: filteredAndSortedSentRequests, stats, loading, loadingMore, error, hasMoreFriends, searchQuery, setSearchQuery, sortField, setSortField, sortDirection, setSortDirection, loadAllFriends, loadMoreFriends, refreshData, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, cancelSentRequest, cancelAllSentRequests,
  };
};
/**
 * Hook simplificado apenas para estatísticas
 */
export const useFriendshipStats = () => {
  const { stats, loading } = useDenormalizedFriends();
  return { stats, loading };
};

/**
 * Hook para verificar status de amizade com usuário específico
 */
export const useFriendshipStatus = (targetUserId: string) => {
  const { friends, requests, sentRequests } = useDenormalizedFriends();
  
  const status = (() => {
    if (friends.some(f => f.friendId === targetUserId)) return 'friends';
    if (requests.some(r => r.friendId === targetUserId)) return 'request_received';
    if (sentRequests.some(s => s.friendId === targetUserId)) return 'request_sent';
    return 'none';
  })();
  
  return status;
};
import { useState, useEffect } from 'react';

interface MutualFriendsData {
  count: number;
  friends: { displayName: string; nickname: string; photoURL: string | null }[];
  timestamp: number;
}

// Cache global com TTL de 5 minutos
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const mutualFriendsCache = new Map<string, MutualFriendsData>();

// Mapa de requisições pendentes para evitar chamadas duplicadas paralelas
const pendingRequests = new Map<string, Promise<{ count: number; friends: { displayName: string; nickname: string; photoURL: string | null }[] }>>();

// Função para gerar chave do cache
const getCacheKey = (userId1: string, userId2: string): string => {
  // Ordenar IDs para que a chave seja a mesma independente da ordem
  const [id1, id2] = [userId1, userId2].sort();
  return `${id1}_${id2}`;
};

// Função para verificar se cache ainda é válido
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_TTL;
};

// Função para obter do cache
export const getMutualFriendsFromCache = (userId1: string, userId2: string): MutualFriendsData | null => {
  const key = getCacheKey(userId1, userId2);
  const cached = mutualFriendsCache.get(key);

  if (cached && isCacheValid(cached.timestamp)) {
    return cached;
  }

  // Remover cache expirado
  if (cached) {
    mutualFriendsCache.delete(key);
  }

  return null;
};

// Função para adicionar ao cache
export const setMutualFriendsCache = (
  userId1: string,
  userId2: string,
  count: number,
  friends: { displayName: string; nickname: string; photoURL: string | null }[]
): void => {
  const key = getCacheKey(userId1, userId2);
  mutualFriendsCache.set(key, {
    count,
    friends,
    timestamp: Date.now()
  });
};

// Hook para usar cache de amigos em comum
export const useMutualFriendsCache = (
  userId1: string,
  userId2: string,
  fetchFn: () => Promise<{ count: number; friends: { displayName: string; nickname: string; photoURL: string | null }[] }>
) => {
  const [data, setData] = useState<{ count: number; friends: { displayName: string; nickname: string; photoURL: string | null }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Verificar cache primeiro
      const cached = getMutualFriendsFromCache(userId1, userId2);
      if (cached) {
        setData({ count: cached.count, friends: cached.friends });
        return;
      }

      // Buscar dados e adicionar ao cache
      setLoading(true);
      try {
        const result = await fetchFn();
        setData(result);
        setMutualFriendsCache(userId1, userId2, result.count, result.friends);
      } catch (error) {
        console.error('Erro ao carregar amigos em comum:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId1, userId2]);

  return { data, loading };
};

// Função para buscar amigos mútuos com deduplicação de chamadas
export const fetchMutualFriendsDeduped = async (
  userId1: string,
  userId2: string,
  fetchFn: () => Promise<{ count: number; friends: { displayName: string; nickname: string; photoURL: string | null }[] }>
): Promise<{ count: number; friends: { displayName: string; nickname: string; photoURL: string | null }[] }> => {
  const key = getCacheKey(userId1, userId2);

  // 1. Verificar cache primeiro
  const cached = getMutualFriendsFromCache(userId1, userId2);
  if (cached) {
    return { count: cached.count, friends: cached.friends };
  }

  // 2. Verificar se já há uma requisição pendente para esse par
  const pending = pendingRequests.get(key);
  if (pending) {
    return pending; // Reutilizar a requisição em andamento
  }

  // 3. Criar nova requisição e armazená-la
  const request = fetchFn().then(result => {
    // Armazenar no cache após sucesso
    setMutualFriendsCache(userId1, userId2, result.count, result.friends);
    return result;
  }).finally(() => {
    // Limpar requisição pendente após conclusão (sucesso ou erro)
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, request);
  return request;
};

// Função para invalidar cache (útil após mudanças de amizade)
export const invalidateMutualFriendsCache = (userId?: string): void => {
  if (userId) {
    // Invalidar apenas entradas relacionadas ao usuário
    const keysToDelete: string[] = [];
    mutualFriendsCache.forEach((_, key) => {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => mutualFriendsCache.delete(key));
  } else {
    // Limpar todo o cache
    mutualFriendsCache.clear();
  }
};

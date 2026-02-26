// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { getRedis } from './redis';

const DEFAULT_TTL = 300; // 5 minutos

// =============================================================================
// OPERAÇÕES DE CACHE
// =============================================================================

/**
 * @name Obter do Cache
 * @summary Busca um valor do cache por chave.
 * @description Realiza uma busca no log de chaves do Redis através do {@link getRedis}. 
 * O valor retornado passa por uma desserialização automática (JSON.parse). 
 * Caso a chave não exista ou o Redis falhe, o sistema retorna null silenciosamente.
 * 
 * @template T - O tipo do dado esperado no retorno (ex: User, Book)
 * @params {string} key - Chave do cache a ser buscada
 * @returns {Promise<T | null>} Valor desserializado ou null
 * @throws {JSONParseError} Silenciosamente capturado se a desserialização falhar.
 * @example
 * const user = await getCached<User>("user:123");
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    // [FAIL-SAFE] Erro no cache não deve impedir o usuário de receber os dados.
    // O sistema apenas reporta o erro internamente e assume cache miss.
    console.error(`[Cache] Erro ao obter chave "${key}":`, error);
    return null;
  }
}

/**
 * @name Definir no Cache
 * @summary Armazena um valor com tempo de expiração.
 * @description Define um valor no cache realizando a serialização JSON e aplicando
 * um tempo de vida (TTL) em segundos. Utiliza {@link getRedis} internamente.
 * 
 * @see {@link getCached} para operação de leitura correspondente.
 * 
 * @params {string} key - Chave do cache
 * @params {any} value - Valor a ser armazenado (será serializado para JSON)
 * @params {number} [ttl=300] - Tempo de vida em segundos
 * @default 300
 * @returns {Promise<void>}
 * @example
 * await setCache("config:global", { theme: "dark" }, 3600);
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    // [FAIL-SAFE] Se o cache falhar na escrita, o sistema continua operando sem cachear.
    console.error(`[Cache] Erro ao definir chave "${key}":`, error);
  }
}

/**
 * @name Invalidar Chave
 * @summary Remove uma chave específica do cache.
 * @description Remove permanentemente um item do Redis baseado em sua chave exata.
 * 
 * @params {string} key - Chave a ser removida
 * @returns {Promise<void>}
 * @example
 * await invalidateCache("user:123");
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const redis = getRedis();
    const deleted = await redis.del(key);
    console.log(`[Cache] Invalidação: "${key}" (${deleted} chave(s) removida(s))`);
  } catch (error) {
    console.error(`[Cache] Erro ao invalidar chave "${key}":`, error);
  }
}

/**
 * @name Invalidar Padrão
 * @summary Remove chaves por padrão glob.
 * @description Invalida todas as chaves que correspondem a um padrão glob (ex: *).
 * Útil para limpar caches em lote (ex: todas as páginas de amigos de um usuário).
 * 
 * @params {string} pattern - Padrão glob das chaves a serem invalidadas
 * @returns {Promise<void>}
 * @example
 * await invalidatePattern("friends:user123*");
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      console.log(`[Cache] Nenhuma chave encontrada para o padrão "${pattern}"`);
      return;
    }

    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();

    console.log(`[Cache] Invalidação completa: ${keys.length} chave(s) correspondendo a "${pattern}"`);
  } catch (error) {
    console.error(`[Cache] Erro ao invalidar padrão "${pattern}":`, error);
  }
}

// =============================================================================
// CHAVES E PADRÕES DE CACHE
// =============================================================================

/**
 * @name Geradores de Chaves
 * @summary Definições centralizadas de chaves Redis.
 * @description Geradores de chaves de cache para manter a consistência em todo o sistema.
 * 
 * @property {(userId: string, page?: number) => string} friends - Gera chave para a lista de amigos paginada.
 * @property {(userId: string) => string} requests - Gera chave para solicitações de amizade recebidas.
 * @property {(userId: string) => string} sentRequests - Gera chave para solicitações enviadas.
 * @property {(userId: string, friendId: string) => string} mutualFriends - Gera chave para amigos em comum entre dois usuários.
 * @property {(userId: string) => string} notifications - Gera chave para a lista de notificações pendentes.
 * @property {(userId: string) => string} friendsPattern - Padrão glob para invalidar todos os caches de amigos de um usuário.
 * @property {(userId: string) => string} requestsPattern - Padrão glob para invalidar solicitações de um usuário.
 * @property {(userId: string) => string} sentPattern - Padrão glob para invalidar solicitações enviadas.
 * @property {(userId: string) => string} mutualPattern - Padrão glob para invalidar amigos mútuos vinculados ao usuário.
 * @property {(userId: string) => string} allUserPattern - Padrão global que abrange todos os dados cacheados de um usuário específico.
 * @example
 * CacheKeys.friends('user123', 1);
 * CacheKeys.friendsPattern('user123');
 */
export const CacheKeys = {
  friends: (userId: string, page: number = 1) => `friends:${userId}:page:${page}`,
  requests: (userId: string) => `requests:${userId}`,
  sentRequests: (userId: string) => `sent:${userId}`,
  mutualFriends: (userId: string, friendId: string) => `mutual:${userId}:${friendId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  friendsPattern: (userId: string) => `friends:${userId}*`,
  requestsPattern: (userId: string) => `requests:${userId}*`,
  sentPattern: (userId: string) => `sent:${userId}*`,
  mutualPattern: (userId: string) => `mutual:${userId}*`,
  allUserPattern: (userId: string) => `*:${userId}*`,
};

// =============================================================================
// UTILITÁRIOS DE DECORATOR
// =============================================================================

/**
 * @name Decorator de Cache
 * @summary Envolve uma função com lógica de cache.
 * @description Higher-Order Function que adiciona transparência de cache a qualquer
 * função assíncrona, gerenciando chaves, expiração e fluxo de HIT/MISS via 
 * {@link getCached} e {@link setCache}.
 * 
 * @template T - Tipo do dado retornado pela função original
 * @template {any[]} Args - Tipos dos argumentos da função original
 * @params {Function} fn - Função original do tipo Promise
 * @params {Function} keyGenerator - Função que gera a chave baseada nos argumentos
 * @params {number} [ttl=300] - Tempo de vida do cache
 * @default 300
 * @returns {Function} Função envolvida com cache
 * @example
 * // Envolve uma função de busca no banco com cache automático de 5 minutos
 * const getSlowDataWithCache = withCache(getSlowData, (id) => CacheKeys.data(id));
 */
export function withCache<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  keyGenerator: (...args: Args) => string,
  ttl: number = DEFAULT_TTL
) {
  return async (...args: Args): Promise<T> => {
    const key = keyGenerator(...args);

    // 1. Tentar buscar do cache (Transparência total para a função original)
    const cached = await getCached<T>(key);
    if (cached !== null) {
      console.log(`[Cache] HIT: ${key}`);
      return cached;
    }

    // 2. Cache MISS - Executar a carga de trabalho original (ex: DB hit)
    console.log(`[Cache] MISS: ${key}`);
    const result = await fn(...args);

    // 3. Persistência assíncrona para requisições subsequentes
    await setCache(key, result, ttl);

    return result;
  };
}

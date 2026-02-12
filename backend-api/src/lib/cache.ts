import { getRedis } from './redis';

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get cached value by key
 * Returns null if not found or error occurs
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
        console.error(`[Cache] Error getting key "${key}":`, error);
        return null; // Graceful fallback
    }
}

/**
 * Set cache value with TTL
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
        console.error(`[Cache] Error setting key "${key}":`, error);
        // Don't throw - caching failure shouldn't break app
    }
}

/**
 * Invalidate single cache key
 */
export async function invalidateCache(key: string): Promise<void> {
    try {
        const redis = getRedis();
        const deleted = await redis.del(key);
        console.log(`[Cache] Invalidated "${key}" (${deleted} key(s) deleted)`);
    } catch (error) {
        console.error(`[Cache] Error invalidating key "${key}":`, error);
    }
}

/**
 * Invalidate all keys matching pattern
 * Example: "friends:user123*" deletes all friend cache for user123
 */
export async function invalidatePattern(pattern: string): Promise<void> {
    try {
        const redis = getRedis();
        const keys = await redis.keys(pattern);

        if (keys.length === 0) {
            console.log(`[Cache] No keys found for pattern "${pattern}"`);
            return;
        }

        const pipeline = redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();

        console.log(`[Cache] Invalidated ${keys.length} key(s) matching "${pattern}"`);
    } catch (error) {
        console.error(`[Cache] Error invalidating pattern "${pattern}":`, error);
    }
}

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
    // Friends list cache
    friends: (userId: string, page: number = 1) => `friends:${userId}:page:${page}`,

    // Friend requests cache
    requests: (userId: string) => `requests:${userId}`,

    // Sent requests cache
    sentRequests: (userId: string) => `sent:${userId}`,

    // Mutual friends cache
    mutualFriends: (userId: string, friendId: string) =>
        `mutual:${userId}:${friendId}`,

    // Patterns for bulk invalidation
    friendsPattern: (userId: string) => `friends:${userId}*`,
    requestsPattern: (userId: string) => `requests:${userId}*`,
    sentPattern: (userId: string) => `sent:${userId}*`,
    mutualPattern: (userId: string) => `mutual:${userId}*`,
    allUserPattern: (userId: string) => `*:${userId}*`,
};

/**
 * Helper to wrap a function with caching
 * Usage: const cachedFn = withCache(expensiveFn, (arg) => `key:${arg}`, 300)
 */
export function withCache<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    keyGenerator: (...args: Args) => string,
    ttl: number = DEFAULT_TTL
) {
    return async (...args: Args): Promise<T> => {
        const key = keyGenerator(...args);

        // Try cache
        const cached = await getCached<T>(key);
        if (cached !== null) {
            console.log(`[Cache] HIT: ${key}`);
            return cached;
        }

        // Cache miss - execute function
        console.log(`[Cache] MISS: ${key}`);
        const result = await fn(...args);

        // Cache result
        await setCache(key, result, ttl);

        return result;
    };
}

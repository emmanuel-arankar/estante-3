// Redis Client com suporte a Mock (dev) e Redis Real (prod)
// Usa dynamic import para evitar erro quando ioredis não está disponível

interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK'>;
    setex(key: string, ttl: number, value: string): Promise<'OK'>;
    del(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    pipeline(): RedisPipeline;
    on(event: string, callback: (...args: any[]) => void): RedisClient;
    quit(): Promise<'OK'>;
}

interface RedisPipeline {
    del(key: string): RedisPipeline;
    exec(): Promise<any[]>;
}

let redisClient: RedisClient | null = null;

/**
 * Get Redis client singleton
 * Usa Redis real se REDIS_HOST estiver definido, senão usa mock
 */
export function getRedis(): RedisClient {
    if (!redisClient) {
        const host = process.env.REDIS_HOST;
        const port = parseInt(process.env.REDIS_PORT || '6379');

        if (host) {
            console.log(`🔴 [Redis] Conectando ao Memorystore: ${host}:${port}`);
            redisClient = createRealRedis(host, port);
        } else {
            console.log('📦 [Redis] Usando cache em memória (Mock - Desenvolvimento)');
            redisClient = createMockRedis();
        }
    }
    return redisClient;
}

/**
 * Cria cliente Redis real (ioredis) via dynamic import
 */
function createRealRedis(host: string, port: number): RedisClient {
    // Dynamic import - só carrega ioredis se realmente precisar
    const Redis = require('ioredis');

    const redis = new Redis({
        host,
        port,
        retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
    });

    redis.on('connect', () => {
        console.log('✅ [Redis] Conectado ao Memorystore');
    });

    redis.on('error', (err: Error) => {
        console.error('❌ [Redis] Erro:', err.message);
    });

    redis.on('close', () => {
        console.log('🔌 [Redis] Conexão fechada');
    });

    return redis as unknown as RedisClient;
}

/**
 * Mock Redis usando Map em memória
 * Funciona idêntico ao Redis real para desenvolvimento
 */
function createMockRedis(): RedisClient {
    const cache = new Map<string, { value: string; expires?: number }>();

    const mockClient: RedisClient = {
        get: async (key: string) => {
            const item = cache.get(key);
            if (!item) return null;

            // Verificar expiração
            if (item.expires && Date.now() > item.expires) {
                cache.delete(key);
                return null;
            }

            return item.value;
        },

        set: async (key: string, value: string) => {
            cache.set(key, { value });
            return 'OK';
        },

        setex: async (key: string, ttl: number, value: string) => {
            const expires = Date.now() + (ttl * 1000);
            cache.set(key, { value, expires });
            return 'OK';
        },

        del: async (key: string) => {
            const existed = cache.has(key);
            cache.delete(key);
            return existed ? 1 : 0;
        },

        keys: async (pattern: string) => {
            // Suporte simples para glob (apenas *)
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return Array.from(cache.keys()).filter(key => regex.test(key));
        },

        pipeline: () => {
            const operations: Array<() => Promise<any>> = [];

            const pipeline: RedisPipeline = {
                del: (key: string) => {
                    operations.push(() => mockClient.del(key));
                    return pipeline;
                },
                exec: async () => {
                    return await Promise.all(operations.map(op => op()));
                }
            };

            return pipeline;
        },

        on: (_event: string, _callback: (...args: any[]) => void) => {
            // Mock de eventos - não faz nada
            return mockClient;
        },

        quit: async () => {
            cache.clear();
            return 'OK';
        }
    };

    return mockClient;
}

/**
 * Fechar conexão Redis
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

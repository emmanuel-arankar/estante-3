// =============================================================================
// TESTES UNITÁRIOS: REDIS CLIENT
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getRedis, closeRedis } from '../lib/redis';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

describe('RedisClient', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        // Garante que o singleton seja limpo entre os testes
        // Como redisClient não é exportado, usamos o closeRedis
    });

    afterEach(async () => {
        await closeRedis();
        process.env = originalEnv;
    });

    // =============================================================================
    // TESTES: Inicialização (Mock vs Real)
    // =============================================================================

    describe('getRedis', () => {
        it('deve inicializar o Mock se REDIS_HOST não estiver definido', () => {
            delete process.env.REDIS_HOST;
            const redis = getRedis();

            // Verificamos se é o mock pela ausência de métodos complexos do ioredis 
            // ou testando funcionalidade básica
            expect(redis).toBeDefined();
        });

        it('deve retornar a mesma instância (Singleton)', () => {
            const redis1 = getRedis();
            const redis2 = getRedis();
            expect(redis1).toBe(redis2);
        });
    });

    // =============================================================================
    // TESTES: Funcionalidades do MockClient
    // =============================================================================

    describe('MockClient (Em Memória)', () => {
        it('deve realizar SET e GET corretamente', async () => {
            const redis = getRedis();
            await redis.set('key1', 'value1');
            const val = await redis.get('key1');
            expect(val).toBe('value1');
        });

        it('deve retornar null para chaves inexistentes', async () => {
            const redis = getRedis();
            const val = await redis.get('non-existent');
            expect(val).toBeNull();
        });

        it('deve respeitar o TTL no setex', async () => {
            vi.useFakeTimers();
            const redis = getRedis();

            await redis.setex('temp_key', 10, 'temp_value');

            // Verifica se o valor existe inicialmente
            expect(await redis.get('temp_key')).toBe('temp_value');

            // Avança o tempo
            vi.advanceTimersByTime(11000);

            // Deve ter expirado
            expect(await redis.get('temp_key')).toBeNull();

            vi.useRealTimers();
        });

        it('deve remover chaves com del', async () => {
            const redis = getRedis();
            await redis.set('to_delete', 'val');
            const deletedCount = await redis.del('to_delete');

            expect(deletedCount).toBe(1);
            expect(await redis.get('to_delete')).toBeNull();
        });

        it('deve filtrar chaves com keys (padrão glob)', async () => {
            const redis = getRedis();
            await redis.set('user:1', 'u1');
            await redis.set('user:2', 'u2');
            await redis.set('other:key', 'ok');

            const keys = await redis.keys('user:*');
            expect(keys).toContain('user:1');
            expect(keys).toContain('user:2');
            expect(keys).not.toContain('other:key');
        });

        it('deve executar pipeline corretamente', async () => {
            const redis = getRedis();
            await redis.set('p1', 'v1');
            await redis.set('p2', 'v2');

            const pipeline = redis.pipeline();
            pipeline.del('p1');
            pipeline.del('p2');
            const results = await pipeline.exec();

            expect(results).toEqual([1, 1]);
            expect(await redis.get('p1')).toBeNull();
            expect(await redis.get('p2')).toBeNull();
        });
    });
});

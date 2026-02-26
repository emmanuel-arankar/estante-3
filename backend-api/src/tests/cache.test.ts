// =============================================================================
// TESTES UNITÁRIOS: CACHE SERVICE
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, setCache, invalidateCache, withCache } from '../lib/cache';
import { getRedis } from '../lib/redis';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

vi.mock('../lib/redis', () => {
    const mockRedis = {
        get: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
        pipeline: vi.fn(() => ({
            del: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([]),
        })),
    };
    return {
        getRedis: vi.fn(() => mockRedis),
    };
});

describe('CacheService', () => {
    const redisMock = getRedis() as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =============================================================================
    // TESTES: Operações Básicas
    // =============================================================================

    describe('getCached', () => {
        it('deve retornar o valor desserializado quando existir no cache', async () => {
            const mockData = { id: 1, name: 'Test' };
            redisMock.get.mockResolvedValue(JSON.stringify(mockData));

            const result = await getCached('test-key');

            expect(result).toEqual(mockData);
            expect(redisMock.get).toHaveBeenCalledWith('test-key');
        });

        it('deve retornar null se a chave não existir', async () => {
            redisMock.get.mockResolvedValue(null);
            const result = await getCached('missing-key');
            expect(result).toBeNull();
        });

        it('deve ser fail-safe e retornar null se o Redis falhar', async () => {
            redisMock.get.mockRejectedValue(new Error('Redis Down'));

            const result = await getCached('any-key');

            expect(result).toBeNull();
            // Não deve lançar erro
        });
    });

    describe('setCache', () => {
        it('deve serializar e salvar o valor com TTL', async () => {
            const mockData = { val: 123 };
            await setCache('save-key', mockData, 60);

            expect(redisMock.setex).toHaveBeenCalledWith('save-key', 60, JSON.stringify(mockData));
        });

        it('deve usar o TTL padrão se não for fornecido', async () => {
            await setCache('default-ttl-key', 'value');
            expect(redisMock.setex).toHaveBeenCalledWith('default-ttl-key', 300, JSON.stringify('value'));
        });

        it('deve ser fail-safe se o Redis falhar no setex', async () => {
            redisMock.setex.mockRejectedValue(new Error('Write Failure'));
            await expect(setCache('key', 'val')).resolves.not.toThrow();
        });
    });

    // =============================================================================
    // TESTES: Decorator withCache
    // =============================================================================

    describe('withCache Decorator', () => {
        const slowFunction = vi.fn(async (id: string) => ({ id, data: 'real-data' }));
        const keyGen = (id: string) => `data:${id}`;

        it('deve dar HIT e não executar a função se o dado estiver no cache', async () => {
            const cachedData = { id: '123', data: 'cached-data' };
            redisMock.get.mockResolvedValue(JSON.stringify(cachedData));

            const decorated = withCache(slowFunction, keyGen);
            const result = await decorated('123');

            expect(result).toEqual(cachedData);
            expect(slowFunction).not.toHaveBeenCalled();
            expect(redisMock.get).toHaveBeenCalledWith('data:123');
        });

        it('deve dar MISS, executar a função e salvar no cache', async () => {
            redisMock.get.mockResolvedValue(null); // MISS
            slowFunction.mockResolvedValue({ id: '456', data: 'new-data' });

            const decorated = withCache(slowFunction, keyGen, 100);
            const result = await decorated('456');

            expect(result).toEqual({ id: '456', data: 'new-data' });
            expect(slowFunction).toHaveBeenCalledWith('456');
            expect(redisMock.setex).toHaveBeenCalledWith('data:456', 100, JSON.stringify(result));
        });

        it('deve ser fail-safe: se o Redis falhar no get, executa a função normalmente', async () => {
            redisMock.get.mockRejectedValue(new Error('Redis Error'));
            slowFunction.mockResolvedValue({ id: 'safe', data: 'safe-data' });

            const decorated = withCache(slowFunction, keyGen);
            const result = await decorated('safe');

            expect(result).toEqual({ id: 'safe', data: 'safe-data' });
            expect(slowFunction).toHaveBeenCalled();
        });
    });
});

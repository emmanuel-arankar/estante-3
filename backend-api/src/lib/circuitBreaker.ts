import { getRedis } from './redis';
import * as logger from 'firebase-functions/logger';

export enum CircuitState {
    CLOSED = 'CLOSED',           // Funcionamento normal
    OPEN = 'OPEN',               // Falhando, bloqueia requisições
    HALF_OPEN = 'HALF_OPEN'      // Testando recuperação
}

interface CircuitOptions {
    failureThreshold: number;    // Quantidade de falhas para abrir o circuito
    resetTimeout: number;        // Tempo (ms) para tentar fechar após abrir
    serviceName: string;         // Nome do serviço para logs e chaves de cache
}

/**
 * @name Circuit Breaker (Disjuntor)
 * @summary Protege a aplicação contra falhas em serviços externos.
 * @description Utiliza o Redis para persistir o estado do disjuntor de forma global
 * entre todas as instâncias das Cloud Functions.
 */
export class CircuitBreaker {
    private options: CircuitOptions;
    private redisKey: string;
    private failureKey: string;

    constructor(options: CircuitOptions) {
        this.options = options;
        this.redisKey = `cb:${options.serviceName}:state`;
        this.failureKey = `cb:${options.serviceName}:failures`;
    }

    /**
     * @name Executar com Proteção
     * @description Envolve uma chamada assíncrona com a lógica do disjuntor.
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const state = await this.getState();

        if (state === CircuitState.OPEN) {
            throw new Error(`Circuit Breaker [${this.options.serviceName}] is OPEN`);
        }

        try {
            const result = await fn();
            await this.onSuccess();
            return result;
        } catch (error) {
            await this.onFailure();
            throw error;
        }
    }

    private async getState(): Promise<CircuitState> {
        const redis = getRedis();
        const state = await redis.get(this.redisKey);

        if (!state) return CircuitState.CLOSED;

        // Se estiver OPEN, verifica se já passou o tempo de reset
        if (state === CircuitState.OPEN) {
            const openTime = await redis.get(`${this.redisKey}:time`);
            if (openTime && Date.now() - parseInt(openTime) > this.options.resetTimeout) {
                await this.setState(CircuitState.HALF_OPEN);
                return CircuitState.HALF_OPEN;
            }
        }

        return state as CircuitState;
    }

    private async onSuccess() {
        const state = await this.getState();
        if (state === CircuitState.HALF_OPEN || state === CircuitState.OPEN) {
            await this.reset();
            logger.info(`Circuit Breaker [${this.options.serviceName}] is now CLOSED`);
        } else {
            // Limpa contador de falhas esporádicas
            const redis = getRedis();
            await redis.del(this.failureKey);
        }
    }

    private async onFailure() {
        const redis = getRedis();
        const failures = await redis.incr(this.failureKey);

        if (failures >= this.options.failureThreshold) {
            await this.setState(CircuitState.OPEN);
            logger.error(`Circuit Breaker [${this.options.serviceName}] is now OPEN`);
        }
    }

    private async setState(state: CircuitState) {
        const redis = getRedis();
        await redis.set(this.redisKey, state);
        if (state === CircuitState.OPEN) {
            await redis.set(`${this.redisKey}:time`, Date.now().toString());
        }
    }

    private async reset() {
        const redis = getRedis();
        await redis.del(this.redisKey);
        await redis.del(`${this.redisKey}:time`);
        await redis.del(this.failureKey);
    }
}

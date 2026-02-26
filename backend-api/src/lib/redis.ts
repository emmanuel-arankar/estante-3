// =============================================================================
// DEFINIÇÕES DE TIPOS (JSDOC)
// =============================================================================

/**
 * @callback RedisEventCallback
 * @description Assinatura para ouvintes de eventos do cliente Redis.
 * @param {...any} args - Argumentos passados pelo evento
 * @returns {void}
 */

/**
 * @callback RetryStrategy
 * @description Função que determina o tempo de espera antes de uma nova tentativa de conexão.
 * @param {number} times - Número de tentativas realizadas até o momento
 * @returns {number | Error | null} Milissegundos de espera ou erro para abortar
 */

// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

/**
 * @name Cliente Redis
 * @summary Interface para operações básicas do Redis.
 * @description Define as operações básicas suportadas pelo cliente Redis em todo o sistema.
 * Suporta tanto o cliente real (ioredis) quanto um mock em memória para desenvolvimento.
 * 
 * @note O uso de interfaces permite que o restante da aplicação não dependa de uma implementação 
 * específica, facilitando a troca de drivers ou mocks em testes.
 * 
 * @property {(key: string) => Promise<string | null>} get - Busca um valor bruto por chave.
 * @property {(key: string, value: string) => Promise<'OK'>} set - Armazena um valor (sem expiração).
 * @property {(key: string, ttl: number, value: string) => Promise<'OK'>} setex - Armazena um valor com tempo de vida definido.
 * @property {(...keys: string[]) => Promise<number>} del - Remove uma ou mais chaves. Retorna o número de chaves removidas.
 * @property {(key: string) => Promise<number>} incr - Incrementa o valor de uma chave.
 * @property {(key: string, seconds: number) => Promise<number>} expire - Define o tempo de vida (TTL) de uma chave existente.
 * @property {(pattern: string) => Promise<string[]>} keys - Busca chaves que correspondem a um padrão glob.
 * @property {() => RedisPipeline} pipeline - Inicia um lote de comandos para execução atômica/em batch.
 * @property {(event: string, callback: RedisEventCallback) => RedisClient} on - Registra ouvintes para eventos de conexão e erro.
 * @property {() => Promise<'OK'>} quit - Encerra a conexão com o servidor de forma limpa.
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK'>;
  setex(key: string, ttl: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  pipeline(): RedisPipeline;
  /**
   * @param {string} event - Nome do evento (ex: 'connect', 'error')
   * @param {RedisEventCallback} callback - Função de retorno
   */
  on(event: string, callback: (...args: any[]) => void): RedisClient;
  quit(): Promise<'OK'>;
}

/**
 * @name Pipeline Redis
 * @summary Interface para operações em lote (pipeline).
 * @description Define a interface para agrupamento de comandos Redis que devem ser
 * executados em uma única viagem de rede (batch/pipeline).
 * 
 * @property {Function} del - Enfileira remoção de chave
 * @property {Function} exec - Executa todos os comandos enfileirados
 */
interface RedisPipeline {
  del(key: string): RedisPipeline;
  exec(): Promise<any[]>;
}

// Singleton da conexão: Mantém uma única instância aberta para reaproveitamento do pool de sockets.
let redisClient: RedisClient | null = null;

// ==== ==== GERENCIAMENTO DE CONEXÃO ==== ====

/**
 * @name Obter Cliente Redis
 * @summary Inicializa ou retorna o singleton do Redis.
 * @description Retorna a instância singleton que implementa a interface {@link RedisClient}. 
 * Usa o Redis real (Memorystore) se REDIS_HOST estiver definido, caso contrário, usa um mock em memória.
 * 
 * @returns {RedisClient} Instância funcional (real ou mock).
 * @example
 * const redis = getRedis();
 */
export function getRedis(): RedisClient {
  if (!redisClient) {
    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT || '6379');

    if (host) {
      console.log(`🔴 [Redis] Conectando ao Memorystore: ${host}:${port}`);
      redisClient = createRealRedis(host, port);
    } else {
      // [FAIL-SAFE] Fallback para mock em memória caso a infraestrutura de Redis não esteja disponível.
      // Isso garante que a aplicação continue funcionando (sem persistência de cache) em qualquer ambiente.
      console.log('📦 [Redis] Usando cache em memória (Mock - Desenvolvimento)');
      redisClient = createMockRedis();
    }
  }
  return redisClient;
}

/**
 * @name Criar Redis Real
 * @summary Instancia ioredis para produção.
 * @description Cria uma instância do cliente Redis real utilizando ioredis. 
 * 
 * @note O 'require' dinâmico é utilizado para que a dependência 'ioredis' não seja carregada 
 * obrigatoriamente em ambientes onde o Redis não é necessário (ex: testes unitários sem Redis).
 * 
 * @params {string} host - Endereço do host Redis
 * @params {number} port - Porta do Redis
 * @returns {RedisClient} Instância configurada do ioredis
 * @example
 * const realRedis = createRealRedis("10.0.0.1", 6379);
 */
function createRealRedis(host: string, port: number): RedisClient {
  // Importação dinâmica: carrega ioredis apenas se necessário (produção)
  const Redis = require('ioredis');

  /**
   * @name Configurações ioredis
   * @summary Parâmetros de inicialização do ioredis.
   * @description Opções de inicialização do cliente Redis real.
   * 
   * @property {string} host - O endereço host do servidor Redis.
   * @property {number} port - A porta do servidor Redis.
   * @property {RetryStrategy} retryStrategy - Função de resiliência para reconexão.
   * @property {number} maxRetriesPerRequest - Limite de tentativas por comando.
   * @property {boolean} enableReadyCheck - Verifica se o servidor está pronto para aceitar comandos.
   * @property {boolean} lazyConnect - Adia a conexão até o primeiro comando ser enviado.
   */
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

// ==== ==== IMPLEMENTAÇÃO MOCK (DESENVOLVIMENTO) ==== ====

/**
 * @name Criar Redis Mock
 * @summary Simula Redis em memória.
 * @description Cria um cliente Redis simulado (Mock) usando um Map em memória. 
 * Ideal para testes locais e desenvolvimento sem necessidade de infraestrutura de Redis.
 * 
 * @returns {RedisClient} Instância simulada do Redis
 * @example
 * const mockRedis = createMockRedis();
 */
function createMockRedis(): RedisClient {
  const cache = new Map<string, { value: string; expires?: number }>();

  /**
   * @name Cliente Mock Redis
   * @summary Implementação em memória do cliente Redis.
   * @description Define o comportamento simulado do Redis para o ambiente de desenvolvimento.
   * 
   * @property {Function} get - Recupera valor do Map interno com verificação de expiração.
   * @property {Function} set - Armazena valor no Map sem expiração.
   * @property {Function} setex - Armazena valor com cálculo de TTL.
   * @property {Function} del - Remove chave do Map.
   * @property {Function} keys - Filtra chaves do Map usando RegExp.
   * @property {Function} pipeline - Cria um lote de operações simuladas.
   * @property {Function} on - No-op para compatibilidade de eventos.
   * @property {Function} quit - Limpa o cache interno.
   */
  const mockClient: RedisClient = {
    get: async (key: string) => {
      const item = cache.get(key);
      if (!item) return null;
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

    del: async (...keys: string[]) => {
      let deleted = 0;
      keys.forEach(key => {
        if (cache.has(key)) {
          cache.delete(key);
          deleted++;
        }
      });
      return deleted;
    },

    expire: async (key: string, seconds: number) => {
      const item = cache.get(key);
      if (!item) return 0;

      const expires = Date.now() + (seconds * 1000);
      cache.set(key, { ...item, expires });
      return 1;
    },

    incr: async (key: string) => {
      const item = cache.get(key);
      let value = 0;
      if (item) {
        value = parseInt(item.value, 10);
        if (isNaN(value)) value = 0;
      }
      value++;
      cache.set(key, { value: value.toString() });
      return value;
    },

    keys: async (pattern: string) => {
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
 * @name Fechar Redis
 * @summary Encerra a conexão Redis.
 * @description Fecha a conexão com o servidor Redis de forma graciosa e limpa o singleton.
 * 
 * @returns {Promise<void>}
 * @example
 * await closeRedis();
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

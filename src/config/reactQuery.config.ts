import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

/**
 * Configuração global do React Query otimizada para Optimistic UI
 * 
 * MELHORIAS IMPLEMENTADAS:
 * - staleTime: 5min (reduz refetches desnecessários)
 * - gcTime: 30min (mantém cache em memória por mais tempo)
 * - Retry logic inteligente (não retry em erros de auth/validação)
 * - Error boundaries para queries e mutations
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // ⚡ PERFORMANCE
            // Dados são considerados "frescos" por 5 minutos
            // Evita refetches desnecessários enquanto usuário navega
            staleTime: 5 * 60 * 1000, // 5 minutos

            // Cache persiste em memória por 30 minutos (gcTime substituiu cacheTime)
            // Garante que dados existem para navegação rápida entre páginas
            gcTime: 30 * 60 * 1000, // 30 minutos

            // 🔄 REVALIDAÇÃO
            // Revalidar quando usuário volta à aba (detecta mudanças em outras abas/dispositivos)
            refetchOnWindowFocus: true,

            // Não revalidar ao montar componente se cache ainda é válido (staleTime)
            // Reduz requisições desnecessárias
            refetchOnMount: false,

            // Revalidar quando internet reconecta (sincronizar após offline)
            refetchOnReconnect: true,

            // 🔁 RETRY
            // Lógica inteligente: não retry em erros de autenticação/validação
            retry: (failureCount, error: any) => {
                // Erros de autenticação/autorização/validação não devem retry
                if (error?.status === 401 || error?.status === 403 || error?.status === 400) {
                    return false;
                }
                // Erros de servidor podem ter retry (máximo 2 tentativas)
                return failureCount < 2;
            },

            // Delay exponencial entre retries: 1s, 2s, 4s (máx 10s)
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },

        mutations: {
            // 🔁 RETRY PARA MUTATIONS
            // Tentar 1 vez se falhar (evita duplicação de ações)
            retry: 1,

            // 1 segundo de delay antes de retry
            retryDelay: 1000,
        }
    },

    // 🎯 GLOBAL ERROR HANDLER - QUERIES
    queryCache: new QueryCache({
        onError: (error: any, query) => {
            // Só logar erros de queries que não são "background refetches"
            // (queries com dados no cache que falharam ao revalidar)
            if (query.state.data !== undefined) {
                console.error('[React Query] Query error (background):', error);
                // Não mostrar toast - dados em cache ainda são válidos
            } else {
                console.error('[React Query] Query error (initial):', error);
                // Toast já é mostrado nas queries individuais se necessário
            }
        },
    }),

    // 🎯 GLOBAL ERROR HANDLER - MUTATIONS
    mutationCache: new MutationCache({
        onError: (error: any, variables, context, mutation) => {
            // Error handling detalhado já está nas mutations individuais
            // (em useDenormalizedFriends.ts)
            console.error('[React Query] Mutation error:', {
                error,
                mutationKey: mutation.options.mutationKey,
            });
        },
    }),
});

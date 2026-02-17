/**
 * Re-exporta o queryClient otimizado de @/config/reactQuery.config
 * 
 * MIGRAÇÃO: Configuração anterior tinha staleTime de 30s.
 * Nova configuração tem staleTime de 5min + retry logic + error handlers.
 * 
 * Benefícios:
 * - Menos refetches desnecessários (5min vs 30s)
 * - Cache persiste por mais tempo (30min vs 2min)
 * - Retry inteligente em erros de rede
 * - Error handling centralizado
 */
export { queryClient } from '@/config/reactQuery.config';
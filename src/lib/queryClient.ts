import { QueryClient } from '@tanstack/react-query';

// Cache mais agressivo: dados ficam "frescos" por apenas 30 segundos
// Isso garante que mudanças no perfil apareçam rapidamente
const thirtySeconds = 30 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: thirtySeconds,
      gcTime: thirtySeconds * 4, // Garbage collect após 2 minutos
    },
  },
});
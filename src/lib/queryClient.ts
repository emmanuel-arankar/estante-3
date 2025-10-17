import { QueryClient } from '@tanstack/react-query';

// Configura um cache que mantém os dados por 5 minutos antes de considerá-los "stale" (velhos)
const fiveMinutes = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: fiveMinutes,
      gcTime: fiveMinutes * 2, // Garbage collect time
    },
  },
});
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement, ReactNode } from 'react';

/**
 * Cria um novo QueryClient para testes
 * Com retry desabilitado para testes mais rápidos
 */
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

interface AllTheProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper com todos os providers necessários
 */
function AllTheProviders({ children }: AllTheProvidersProps) {
  const testQueryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={testQueryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Renderiza componente com todos os providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export tudo do @testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

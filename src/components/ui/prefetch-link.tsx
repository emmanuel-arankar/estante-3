import { Link, LinkProps } from 'react-router-dom';
import { useQueryClient, QueryKey } from '@tanstack/react-query';
import React, { useCallback } from 'react';

// Tipagem para a query que será pré-carregada
interface PrefetchQuery {
  queryKey: QueryKey;
  queryFn: () => Promise<unknown>;
}

interface PrefetchLinkProps extends LinkProps {
  query: PrefetchQuery;
}

/**
 * Um componente Link que pré-carrega os dados da rota de destino
 * quando o usuário passa o mouse sobre ele.
 *
 * Performance Optimization: Wrapped in React.memo and uses useCallback for handleMouseEnter
 * to prevent unnecessary re-renders and handler recreations in dense list views (friends list,
 * review cards, comments, and mention chips).
 */
export const PrefetchLink = React.memo(
  React.forwardRef<HTMLAnchorElement, PrefetchLinkProps>(
    ({ query, ...props }, ref) => {
      const queryClient = useQueryClient();

      const handleMouseEnter = useCallback(() => {
        // Inicia o pré-carregamento dos dados em segundo plano
        queryClient.prefetchQuery(query);
      }, [queryClient, query]);

      return (
        <Link
          ref={ref}
          onMouseEnter={handleMouseEnter}
          onFocus={handleMouseEnter}
          {...props}
        />
      );
    }
  )
);

PrefetchLink.displayName = 'PrefetchLink';

import { Link, LinkProps } from 'react-router-dom';
import { useQueryClient, QueryKey } from '@tanstack/react-query';
import React from 'react';

// Tipagem para a query que será pré-carregada
interface PrefetchQuery {
  queryKey: QueryKey;
  queryFn: () => Promise<any>;
}

interface PrefetchLinkProps extends LinkProps {
  query: PrefetchQuery;
}

/**
 * Um componente Link que pré-carrega os dados da rota de destino
 * quando o usuário passa o mouse sobre ele.
 */
export const PrefetchLink = React.forwardRef<
  HTMLAnchorElement,
  PrefetchLinkProps
>(({ query, ...props }, ref) => {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Inicia o pré-carregamento dos dados em segundo plano
    queryClient.prefetchQuery(query);
  };

  return (
    <Link
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter} 
      {...props}
    />
  );
});

PrefetchLink.displayName = 'PrefetchLink';
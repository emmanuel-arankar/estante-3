import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';

/**
 * Componente invisível que monitora mudanças de rota e envia 'page_view' para o Firebase Analytics.
 * Deve ser colocado DENTRO do RouterProvider, de preferência no nível mais alto das rotas (ex: AppLayout).
 */
export function AnalyticsRouteTracker() {
    const location = useLocation();

    useEffect(() => {
        // Registra a visualização da página com o caminho atual
        trackEvent('page_view', {
            page_path: location.pathname,
            page_search: location.search,
            page_hash: location.hash,
        });
    }, [location]);

    return null;
}

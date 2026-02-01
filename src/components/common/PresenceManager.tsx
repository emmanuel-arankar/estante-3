import { useManageMyPresence } from '@/hooks/useUserPresence';
import { useAuth } from '@/hooks/useAuth';

/**
 * PresenceManager
 * Este componente garante que a lógica de "estar online" e o listener de autenticação
 * permaneçam ativos durante toda a vida do app, mesmo se uma rota der erro.
 */
export const PresenceManager = ({ children }: { children: React.ReactNode }) => {
    // Inicializa o listener de autenticação global
    useAuth();

    // Inicializa a presença sticky
    useManageMyPresence();

    return <>{children}</>;
};

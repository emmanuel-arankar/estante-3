import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Cross-Tab Sync Events
 * Sincroniza ações de amizade entre múltiplas abas do mesmo usuário
 */
type SyncEventType =
    | 'FRIEND_REQUEST_SENT'
    | 'FRIEND_REQUEST_ACCEPTED'
    | 'FRIEND_REQUEST_REJECTED'
    | 'FRIEND_REMOVED'
    | 'SENT_REQUEST_CANCELLED';

interface SyncEvent {
    type: SyncEventType;
    data: {
        friendshipId: string;
        userId?: string;
        friendId?: string;
        timestamp: number;
    };
}

/**
 * Hook para sincronizar estado de amizades entre abas/janelas
 * Usa BroadcastChannel API (suportado em todos os browsers modernos)
 * 
 * @example
 * // Usar no useDenormalizedFriends
 * const { broadcast } = useCrossTabSync();
 * 
 * // Após uma ação, notificar outras abas
 * onSuccess: () => {
 *   broadcast('FRIEND_REQUEST_ACCEPTED', { friendshipId });
 * }
 */
export const useCrossTabSync = () => {
    const queryClient = useQueryClient();

    // Criar canal de broadcast (nome: 'estante-friendships')
    const channel = useMemo(() => {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('BroadcastChannel not supported in this browser');
            return null;
        }
        return new BroadcastChannel('estante-friendships');
    }, []);

    useEffect(() => {
        if (!channel) return;

        // Escutar mensagens de outras abas
        const handleMessage = (event: MessageEvent<SyncEvent>) => {
            const { type, data } = event.data;

            console.log(`[CrossTabSync] Received event from another tab:`, type, data);

            // Invalidar queries relevantes baseado no tipo de evento
            switch (type) {
                case 'FRIEND_REQUEST_SENT':
                    // Invalidar lista de solicitações enviadas
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'sent'],
                        refetchType: 'all'
                    });
                    break;

                case 'FRIEND_REQUEST_ACCEPTED':
                    // Invalidar lista de amigos E solicitações recebidas
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'list'],
                        refetchType: 'all'
                    });
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'requests'],
                        refetchType: 'all'
                    });
                    break;

                case 'FRIEND_REQUEST_REJECTED':
                    // Invalidar lista de solicitações recebidas
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'requests'],
                        refetchType: 'all'
                    });
                    break;

                case 'FRIEND_REMOVED':
                    // Invalidar lista de amigos
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'list'],
                        refetchType: 'all'
                    });
                    break;

                case 'SENT_REQUEST_CANCELLED':
                    // Invalidar lista de solicitações enviadas
                    queryClient.invalidateQueries({
                        queryKey: ['friends', 'sent'],
                        refetchType: 'all'
                    });
                    break;

                default:
                    console.warn(`[CrossTabSync] Unknown event type: ${type}`);
            }
        };

        channel.addEventListener('message', handleMessage);

        return () => {
            channel.removeEventListener('message', handleMessage);
        };
    }, [channel, queryClient]);

    /**
     * Envia evento para todas as outras abas
     * Nota: A aba que envia NÃO recebe a própria mensagem
     */
    const broadcast = (
        type: SyncEventType,
        data: Omit<SyncEvent['data'], 'timestamp'>
    ) => {
        if (!channel) return;

        const event: SyncEvent = {
            type,
            data: {
                ...data,
                timestamp: Date.now()
            }
        };

        try {
            console.log(`[CrossTabSync] Broadcasting event:`, type, data);
            channel.postMessage(event);
        } catch (error) {
            // ✅ Tratamento: Se o canal foi fechado, apenas logar (não é erro crítico)
            console.warn(`[CrossTabSync] Failed to broadcast (channel may be closed):`, error);
        }
    };

    return { broadcast };
};

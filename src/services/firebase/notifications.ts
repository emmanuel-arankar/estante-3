import { Notification } from '@estante/common-types';
import { apiClient } from '@/services/api/apiClient';

export interface NotificationsResponse {
    data: Notification[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
        nextCursor?: string;
    };
}

export interface UnreadCountResponse {
    count: number;
}

/**
 * Helper para construir query string a partir de params
 */
const buildQueryString = (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
        }
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
};

/**
 * Lista notificações do usuário
 */
export const listNotifications = async (params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    cursor?: string;
}): Promise<NotificationsResponse> => {
    const qs = buildQueryString(params || {});
    return await apiClient<NotificationsResponse>(`/notifications${qs}`);
};

/**
 * Marca notificação como lida
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    await apiClient(`/notifications/${notificationId}/read`, {
        method: 'POST',
    });
};

/**
 * Marca todas notificações como lidas
 */
export const markAllNotificationsAsRead = async (): Promise<{ count: number }> => {
    return await apiClient<{ count: number }>('/notifications/mark-all-read', {
        method: 'POST',
    });
};

/**
 * Remove notificação
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
    await apiClient(`/notifications/${notificationId}`, {
        method: 'DELETE',
    });
};

/**
 * Busca contador de notificações não lidas
 */
export const getUnreadCount = async (): Promise<number> => {
    const data = await apiClient<UnreadCountResponse>('/notifications/unread-count');
    return data.count;
};

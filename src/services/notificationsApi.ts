import type { Notification, NotificationResponse } from '@estante/common-types';

const API_BASE_URL = '/api';

/**
 * List notifications for the current user
 */
export const listNotificationsAPI = async (params: {
    limit?: number;
    unreadOnly?: boolean;
}): Promise<NotificationResponse> => {
    const queryParams = new URLSearchParams({
        limit: String(params.limit || 20),
        ...(params.unreadOnly && { unreadOnly: 'true' })
    });

    const res = await fetch(`${API_BASE_URL}/notifications?${queryParams}`, {
        credentials: 'include'
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to fetch notifications');
    }

    return res.json();
};

/**
 * Mark notification as read
 */
export const markNotificationAsReadAPI = async (notificationId: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'include'
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to mark notification as read');
    }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsReadAPI = async (): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include'
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to mark all as read');
    }
};

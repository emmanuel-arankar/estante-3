export interface Notification {
    id: string;
    userId: string;           // Who receives the notification
    type: NotificationType;
    actorId: string;          // Who triggered the action
    actorName: string;
    actorPhoto: string;
    read: boolean;
    createdAt: Date;
    metadata?: NotificationMetadata;
}

export type NotificationType =
    | 'FRIEND_REQUEST'
    | 'FRIEND_ACCEPTED'
    | 'FRIEND_REJECTED';

export interface NotificationMetadata {
    friendshipId?: string;
    isRequester?: boolean;  // true = notification for requester, false = notification for accepter
}

export interface NotificationResponse {
    data: Notification[];
    unreadCount: number;
    hasMore: boolean;
}

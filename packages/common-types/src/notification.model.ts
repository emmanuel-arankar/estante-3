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
    | 'friend_request'
    | 'friend_accepted'
    | 'friend_rejected';

export interface NotificationMetadata {
    friendshipId?: string;
    isRequester?: boolean;  // true = notification for requester, false = notification for accepter
    actorNickname?: string; // Nickname do ator para links de perfil
}

export interface NotificationResponse {
    data: Notification[];
    unreadCount: number;
    hasMore: boolean;
}

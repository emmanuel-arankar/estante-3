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
    | 'friend_rejected'
    | 'like_review'
    | 'like_review_comment'
    | 'review_comment_created'
    | 'comment_reply_created'
    | 'suggestion_approved'
    | 'suggestion_rejected';

export interface NotificationMetadata {
    friendshipId?: string;
    isRequester?: boolean;
    actorNickname?: string;
    reviewId?: string;
    commentId?: string;
    workId?: string;
    editionId?: string;
    suggestionId?: string;
    suggestionTitle?: string;
    reviewNote?: string;
}

export interface NotificationResponse {
    data: Notification[];
    unreadCount: number;
    hasMore: boolean;
}

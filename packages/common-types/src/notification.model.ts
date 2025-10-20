export type NotificationType = 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'friend_request' | 'friend_accept';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  fromUserId: string;
  postId?: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
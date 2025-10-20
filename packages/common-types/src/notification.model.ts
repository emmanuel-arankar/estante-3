export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'mention' | 'friend_request' | 'friend_accept';
  fromUserId: string;
  postId?: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
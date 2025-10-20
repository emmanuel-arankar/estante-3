export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'book';
  readAt?: Date;
  createdAt: Date;
}
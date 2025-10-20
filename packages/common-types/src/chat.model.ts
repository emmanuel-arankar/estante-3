export type ChatMessageType = 'text' | 'image' | 'book';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: ChatMessageType;
  readAt?: Date;
  createdAt: Date;
}
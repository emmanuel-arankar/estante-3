export type UserRole = 'user' | 'librarian' | 'manager' | 'Assistant' | 'admin'

export interface User {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  photoURL?: string;
  role?: UserRole;
  bio?: string;
  location?: string;
  website?: string;
  birthDate?: Date;
  joinedAt: Date;
  booksRead: number;
  currentlyReading: number;
  followers: number;
  following: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;
  friendshipDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendshipWithUser extends Friendship {
  friend: User;          // Dados completos do amigo (para joins)
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
  description?: string;
  publishYear?: number;
  genre?: string;
  pages?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBook {
  id: string;
  userId: string;
  bookId: string;
  status: 'reading' | 'completed' | 'want-to-read' | 'abandoned';
  rating?: number;
  review?: string;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  type: 'status' | 'review' | 'quote' | 'discussion' | 'avatar_update';
  bookId?: string;
  mediaUrls?: string[];
  likes: string[];
  comments: Comment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAvatar {
  id: string;
  userId: string;
  originalUrl: string;
  croppedUrl: string;
  isPublic: boolean;
  cropData: {
    x: number;
    y: number;
    zoom: number;
    croppedArea: any;
  };
  uploadedAt: Date;
  isCurrent: boolean;
  likes: string[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  likes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'book';
  readAt?: Date;
  createdAt: Date;
}

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
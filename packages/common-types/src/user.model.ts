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
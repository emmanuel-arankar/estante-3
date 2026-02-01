export type UserRole = 'user' | 'librarian' | 'manager' | 'assistant' | 'admin'

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
  friendsCount?: number;
  pendingRequestsCount?: number;
  sentRequestsCount?: number;
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
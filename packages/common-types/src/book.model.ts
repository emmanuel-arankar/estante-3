export type UserBookStatus = 'reading' | 'completed' | 'want-to-read' | 'abandoned';

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
  status: UserBookStatus;
  rating?: number;
  review?: string;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
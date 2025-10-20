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

export interface Comment {
  id: string;
  userId: string;
  content: string;
  likes: string[];
  createdAt: Date;
  updatedAt: Date;
}
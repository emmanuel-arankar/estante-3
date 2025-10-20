export type PostType = 'status' | 'review' | 'quote' | 'discussion' | 'avatar_update';

export interface Post {
  id: string;
  userId: string;
  content: string;
  type: PostType;
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
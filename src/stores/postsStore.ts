import { create } from 'zustand';
import { Post } from '../models';

interface PostsState {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  deletePost: (postId: string) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePostsStore = create<PostsState>((set) => ({
  posts: [],
  loading: false,
  hasMore: true,
  error: null,
  setPosts: (posts) => set({ posts }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  updatePost: (postId, updates) =>
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, ...updates } : post
      ),
    })),
  deletePost: (postId) =>
    set((state) => ({
      posts: state.posts.filter((post) => post.id !== postId),
    })),
  setLoading: (loading) => set({ loading }),
  setHasMore: (hasMore) => set({ hasMore }),
  setError: (error) => set({ error }),
}));
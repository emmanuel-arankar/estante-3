import { useState, useEffect, useCallback } from 'react';
import { usePostsStore } from '../stores/postsStore';
import { useAuth } from './useAuth';
import {
  getPosts,
  createPost,
  likePost,
  unlikePost,
  addComment,
  subscribeToFeedPosts,
} from '../services/firestore';
import { Post, Comment } from '../models';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';

export const usePosts = () => {
  const { user } = useAuth();
  const {
    posts,
    loading,
    hasMore,
    error,
    setPosts,
    addPost,
    updatePost,
    setLoading,
    setHasMore,
    setError,
  } = usePostsStore();

  const [lastDoc, setLastDoc] = useState<any>(null);

  // Load initial posts
  const loadPosts = useCallback(async (refresh = false) => {
    if (loading && !refresh) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getPosts(refresh ? null : lastDoc);
      
      if (refresh) {
        setPosts(result.posts);
      } else {
        setPosts([...posts, ...result.posts]);
      }
      
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao carregar posts');
      toastErrorClickable('Erro ao carregar posts');
    } finally {
      setLoading(false);
    }
  }, [loading, lastDoc, posts, setPosts, setLoading, setHasMore, setError]);

  // Create new post
  const handleCreatePost = useCallback(async (postData: {
    content: string;
    type: Post['type'];
    bookId?: string;
    mediaUrls?: string[];
  }) => {
    if (!user) {
      toastErrorClickable('Você precisa estar logado para criar um post');
      return;
    }

    try {
      const newPost: Omit<Post, 'id'> = {
        userId: user.uid,
        content: postData.content,
        type: postData.type,
        bookId: postData.bookId,
        mediaUrls: postData.mediaUrls || [],
        likes: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const postId = await createPost(newPost);
      const createdPost: Post = { id: postId, ...newPost };
      
      addPost(createdPost);
      toastSuccessClickable('Post criado com sucesso!');
    } catch (error) {
      toastErrorClickable('Erro ao criar post');
      console.error('Error creating post:', error);
    }
  }, [user, addPost]);

  // Like/Unlike post
  const handleLikePost = useCallback(async (postId: string) => {
    if (!user) {
      toastErrorClickable('Você precisa estar logado para curtir');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const isLiked = post.likes.includes(user.uid);
      
      if (isLiked) {
        await unlikePost(postId, user.uid);
        updatePost(postId, {
          likes: post.likes.filter(id => id !== user.uid),
        });
      } else {
        await likePost(postId, user.uid);
        updatePost(postId, {
          likes: [...post.likes, user.uid],
        });
      }
    } catch (error) {
      toastErrorClickable('Erro ao curtir post');
      console.error('Error liking post:', error);
    }
  }, [user, posts, updatePost]);

  // Add comment
  const handleAddComment = useCallback(async (postId: string, content: string) => {
    if (!user) {
      toastErrorClickable('Você precisa estar logado para comentar');
      return;
    }

    try {
      const comment: Omit<Comment, 'id'> = {
        userId: user.uid,
        content,
        likes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addComment(postId, comment);
      
      const post = posts.find(p => p.id === postId);
      if (post) {
        updatePost(postId, {
          comments: [...post.comments, { id: Date.now().toString(), ...comment }],
        });
      }
      
      toastSuccessClickable('Comentário adicionado!');
    } catch (error) {
      toastErrorClickable('Erro ao adicionar comentário');
      console.error('Error adding comment:', error);
    }
  }, [user, posts, updatePost]);

  // Load more posts (infinite scroll)
  const loadMorePosts = useCallback(() => {
    if (!loading && hasMore) {
      loadPosts(false);
    }
  }, [loading, hasMore, loadPosts]);

  // Refresh posts
  const refreshPosts = useCallback(() => {
    setLastDoc(null);
    loadPosts(true);
  }, [loadPosts]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToFeedPosts((newPosts) => {
      // Only update if we have fewer posts than the real-time feed
      if (posts.length === 0) {
        setPosts(newPosts);
      }
    });

    return unsubscribe;
  }, [setPosts, posts.length]);

  // Initial load
  useEffect(() => {
    if (posts.length === 0) {
      loadPosts(true);
    }
  }, []);

  return {
    posts,
    loading,
    hasMore,
    error,
    loadMorePosts,
    refreshPosts,
    createPost: handleCreatePost,
    likePost: handleLikePost,
    addComment: handleAddComment,
  };
};
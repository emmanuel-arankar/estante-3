import InfiniteScroll from 'react-infinite-scroll-component';
import { motion } from 'framer-motion';
import { CreatePost } from '@/components/feed/CreatePost';
import { PostCard } from '@/components/feed/PostCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { usePosts } from '@/hooks/usePosts';

export const Feed = () => {
  const { user } = useAuth();
  const {
    posts,
    loading,
    hasMore,
    loadMorePosts,
    createPost,
    likePost,
    addComment,
  } = usePosts();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {user && <CreatePost onSubmit={createPost} />}
      
      <InfiniteScroll
        dataLength={posts.length}
        next={loadMorePosts}
        hasMore={hasMore}
        loader={
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        }
        endMessage={
          <div className="text-center py-8">
            <p className="text-gray-500">Você viu todos os posts disponíveis!</p>
          </div>
        }
      >
        <div className="space-y-6">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <PostCard 
                post={post} 
                onLike={likePost}
                onComment={addComment}
              />
            </motion.div>
          ))}
        </div>
      </InfiniteScroll>
    </div>
  );
};
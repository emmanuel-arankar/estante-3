import { useState } from 'react';
import { Heart, MessageCircle, Share2, BookOpen, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Post } from '../../models';
import { useAuth } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string, content: string) => void;
  onShare?: (postId: string) => void;
}

export const PostCard = ({ post, onLike, onComment, onShare }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { user } = useAuth();

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(post.id);
  };

  const handleComment = () => {
    if (commentText.trim() && onComment) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  // Função segura para formatar datas
  const formatDateSafe = (date: Date | string | number | undefined | null): string => {
    if (!date) return 'há algum tempo';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return 'há algum tempo';
      
      return formatDistanceToNow(dateObj, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'há algum tempo';
    }
  };

  // Verifica se o usuário atual curtiu o post
  const isPostLiked = user ? post.likes.includes(user.uid) : false;

  const getPostTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      status: 'Status',
      review: 'Resenha',
      quote: 'Citação',
      discussion: 'Discussão',
      avatar_update: 'Foto do Perfil',
    };
    return labels[type] || type;
  };

  const getPostTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      status: 'bg-blue-100 text-blue-800',
      review: 'bg-green-100 text-green-800',
      quote: 'bg-purple-100 text-purple-800',
      discussion: 'bg-orange-100 text-orange-800',
      avatar_update: 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm">Usuário {post.userId.slice(0, 8)}</h3>
                  <Badge variant="secondary" className={getPostTypeColor(post.type)}>
                    {getPostTypeLabel(post.type)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {formatDateSafe(post.createdAt)}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Conteúdo do Post */}
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-900 leading-relaxed">{post.content}</p>
          </div>

          {/* Livro Relacionado */}
          {post.bookId && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <div>
                  <h4 className="font-medium text-sm">Livro Relacionado</h4>
                  <p className="text-xs text-gray-600">ID: {post.bookId}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mídia */}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {post.mediaUrls.map((url, index) => (
                <div key={index} className="rounded-lg overflow-hidden">
                  <img
                    src={url}
                    alt={`Mídia ${index + 1}`}
                    className={`w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer ${
                      post.type === 'avatar_update' ? 'h-64 object-cover' : 'h-48'
                    }`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`space-x-2 ${isPostLiked ? 'text-red-600' : 'text-gray-600'}`}
              >
                <Heart className={`h-4 w-4 ${isPostLiked ? 'fill-current' : ''}`} />
                <span>{post.likes.length}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="space-x-2 text-gray-600"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{post.comments.length}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShare?.(post.id)}
                className="space-x-2 text-gray-600"
              >
                <Share2 className="h-4 w-4" />
                <span>Compartilhar</span>
              </Button>
            </div>
          </div>

          {/* Comentários */}
          {showComments && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              {/* Campo para adicionar novo comentário */}
              {user && (
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex space-x-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Adicione um comentário..."
                      className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      size="sm"
                      onClick={handleComment}
                      disabled={!commentText.trim()}
                    >
                      Enviar
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de comentários */}
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex items-start space-x-3">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium">Usuário {comment.userId.slice(0, 8)}</p>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500 h-auto p-0"
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        {comment.likes.length}
                      </Button>
                      <span className="text-xs text-gray-500">
                        {formatDateSafe(comment.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
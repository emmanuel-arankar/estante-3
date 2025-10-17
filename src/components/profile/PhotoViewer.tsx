import { ArrowLeft } from 'lucide-react';
import { Heart, MessageCircle, Send, MoveVertical as MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';
import { likeAvatar, commentOnAvatar, getUserAvatars } from '../../services/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { LoadingSpinner } from '../ui/loading-spinner';
 
interface PhotoViewerProps {
  imageUrl: string;
  onClose: () => void;
  userAvatar?: string;
  userName?: string;
  postDate?: string;
  userId?: string;
  avatarId?: string;
}

export const PhotoViewer = ({ 
  imageUrl, 
  onClose, 
  userAvatar, 
  userName = "Usuário", 
  postDate = "Data não disponível",
  userId,
  avatarId
}: PhotoViewerProps) => {
  const { user } = useAuth();
  const [avatarData, setAvatarData] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carregar dados do avatar
  useEffect(() => {
    const loadAvatarData = async () => {
      if (!userId || !avatarId) {
        setLoading(false);
        return;
      }

      try {
        const avatars = await getUserAvatars(userId);
        const avatar = avatars.find(a => a.id === avatarId);
        
        if (avatar) {
          setAvatarData(avatar);
          setLikesCount(avatar.likes?.length || 0);
          setIsLiked(user ? avatar.likes?.includes(user.uid) || false : false);
          setComments(avatar.comments || []);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do avatar:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAvatarData();
  }, [userId, avatarId, user]);

  const handleLike = async () => {
    if (!user || !avatarId || isLiking) return;

    setIsLiking(true);
    try {
      await likeAvatar(avatarId, user.uid);
      
      if (isLiked) {
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Erro ao curtir avatar:', error);
      toastErrorClickable('Erro ao curtir foto');
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async () => {
    if (!user || !avatarId || !newComment.trim() || isSubmittingComment) return;
  
    setIsSubmittingComment(true);
    try {
      const commentId = Date.now().toString();
      
      const comment = {
        userId: user.uid,
        content: newComment.trim(),
        likes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await commentOnAvatar(avatarId, comment);
      
      // Adiciona o comentário localmente
      setComments(prev => [...prev, comment]);
      setNewComment('');
      toastSuccessClickable('Comentário adicionado!');
    } catch (error) {
      console.error('Erro ao comentar:', error);
      toastErrorClickable('Erro ao adicionar comentário');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 overflow-hidden border-none bg-transparent">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-black w-full h-full flex"
        >
          {/* Conteúdo principal - Foto */}
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4 flex justify-between items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="text-lg font-semibold text-white mx-4">
                Foto do perfil
              </DialogTitle>
              {/* Espaço reservado para o X padrão do Dialog */}
              <div className="w-10 h-10"></div>
            </div>

            {/* Imagem - Contêiner flexível */}
            <div className="w-full h-full flex items-center justify-center p-4 pt-16 pb-16">
              <img
                src={imageUrl}
                alt="Foto do perfil"
                className="max-w-full max-h-full object-contain rounded-lg"
                style={{ aspectRatio: '1/1' }}
              />
            </div>
          </div>

          {/* Barra lateral clara */}
          <div className="w-80 bg-white dark:bg-gray-100 border-l border-gray-200 flex flex-col h-full">
            {/* Cabeçalho da barra lateral com espaço para o X */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback className="bg-gray-200 text-gray-700">
                    {userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-gray-900">{userName}</h3>
                  <p className="text-xs text-gray-500">Postado em {postDate}</p>
                </div>
              </div>
              {/* Espaço extra para garantir que o X padrão do Dialog seja visível */}
              <div className="w-8"></div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <>
                {/* Ações (Curtir/Comentar) */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLike}
                      disabled={!user || isLiking}
                      className={`space-x-2 ${isLiked ? 'text-red-600' : 'text-gray-600'}`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                      <span>{likesCount}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="space-x-2 text-gray-600"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{comments.length}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="ml-auto">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Comentários */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">Nenhum comentário ainda</p>
                        <p className="text-sm text-gray-400">Seja o primeiro a comentar!</p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex items-start space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} />
                            <AvatarFallback className="text-xs">
                              {comment.userName?.charAt(0).toUpperCase() || comment.userId.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">
                                {comment.userName || `Usuário ${comment.userId.slice(0, 8)}`}
                              </p>
                              <p className="text-sm text-gray-700">{comment.content}</p>
                            </div>
                            <div className="flex items-center space-x-4 mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-gray-500 h-auto p-0"
                              >
                                <Heart className="h-3 w-3 mr-1" />
                                {comment.likes?.length || 0}
                              </Button>
                              <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(comment.createdAt), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Input de Comentário */}
                {user && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.displayName?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Adicione um comentário..."
                          className="min-h-[60px] resize-none"
                          disabled={isSubmittingComment}
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={handleComment}
                            disabled={!newComment.trim() || isSubmittingComment}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isSubmittingComment ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <>
                                <Send className="h-3 w-3 mr-1" />
                                Comentar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
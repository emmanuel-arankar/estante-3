import React, { useState } from 'react';
import { Review } from '@estante/common-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReviewAPI, likeReviewAPI, getReviewLikersAPI } from '@/services/api/reviewsApi';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, Heart, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { PATHS } from '@/router/paths';
import { userByNicknameQuery } from '@/features/users/user.queries';
import { ReviewComments } from './ReviewComments';
import { StarRating } from '@/features/books/components/StarRating';
import { trackEvent } from '@/lib/analytics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { PhotoViewer } from '@/components/profile/PhotoViewer';

// ==== ==== AVATAR GROUP DE CURTIDAS (hover popover) ==== ====

interface LikerInfo {
  userId: string;
  userName: string;
  userNickname: string;
  userPhotoUrl: string | null;
}

interface LikesAvatarGroupProps {
  reviewId: string;
  likesCount: number;
  liked: boolean;
  onLike: () => void;
  isPending: boolean;
  authenticated: boolean;
}

const LikesAvatarGroup: React.FC<LikesAvatarGroupProps> = ({
  reviewId, likesCount, liked, onLike, isPending, authenticated
}) => {
  const [likers, setLikers] = useState<LikerInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadLikers = async () => {
    if (loaded || likesCount === 0) return;
    try {
      const res = await getReviewLikersAPI(reviewId);
      setLikers((res.data || []).slice(0, 3));
      setLoaded(true);
    } catch { /* silencioso */ }
  };

  React.useEffect(() => {
    if (likesCount > 0 && !loaded) {
      loadLikers();
    }
  }, [likesCount, reviewId]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={authenticated ? onLike : undefined}
        disabled={isPending}
        className={`flex items-center gap-1.5 text-sm font-semibold transition-colors group ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} disabled:opacity-60`}
      >
        <Heart className={`w-4 h-4 transition-transform group-hover:scale-110 ${liked ? 'fill-red-500' : ''}`} strokeWidth={1.5} />
        <span>{likesCount}</span>
      </button>

      {likesCount > 0 && likers.length > 0 && (
        <div className="flex -space-x-2 ml-1">
          {likers.map((l, i) => (
            <div key={l.userId || i} style={{ zIndex: likers.length - i }}>
              <OptimizedAvatar
                src={l.userPhotoUrl || undefined}
                alt={l.userName || '?'}
                fallback={l.userName || '?'}
                size="xs"
                className="ring-2 ring-white"
              />
            </div>
          ))}
          {likesCount > 3 && (
            <div className="h-6 w-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center z-0">
              <span className="text-[10px] font-bold text-gray-500">+{likesCount - 3}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==== ==== REVIEW CARD ==== ====

interface ReviewCardProps {
  review: Review;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const [optimisticLiked, setOptimisticLiked] = useState(!!(review as any).isLiked);
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(review.likesCount || 0);

  // Sincronizar com dados do servidor quando mudarem
  React.useEffect(() => {
    setOptimisticLiked(!!(review as any).isLiked);
    setOptimisticLikesCount(review.likesCount || 0);
  }, [(review as any).isLiked, review.likesCount]);

  const deleteMutation = useMutation({
    mutationFn: async () => deleteReviewAPI(review.id),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      setIsMenuOpen(false);
      toastSuccessClickable('Resenha excluída com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['editions'] });
    },
    onError: () => {
      toastErrorClickable('Ocorreu um erro ao excluir a resenha.');
    }
  });

  const likeMutation = useMutation({
    mutationFn: () => likeReviewAPI(review.id),
    onMutate: () => {
      setOptimisticLiked(prev => {
        const next = !prev;
        setOptimisticLikesCount(c => next ? c + 1 : Math.max(0, c - 1));
        return next;
      });
    },
    onSuccess: (data) => {
      if (data.liked) {
        trackEvent('review_liked');
      }
      setOptimisticLiked(data.liked);
      setOptimisticLikesCount(data.likesCount);
    },
    onError: () => {
      setOptimisticLiked(prev => {
        const reverted = !prev;
        setOptimisticLikesCount(c => reverted ? c + 1 : Math.max(0, c - 1));
        return reverted;
      });
    }
  });

  const isOwner = user?.uid === review.userId;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:border-gray-200 ${deleteMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Cabeçalho */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-4">
        <div className="flex gap-3 items-center">
          <button
            onClick={() => { if (review.userPhotoUrl) setShowPhotoViewer(true); }}
            className={review.userPhotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
          >
            <OptimizedAvatar
              src={review.userPhotoUrl || undefined}
              alt={`Foto de ${review.userName || '?'}`}
              fallback={review.userName || '?'}
              size="md"
              className="flex-shrink-0"
            />
          </button>
          <div>
            <PrefetchLink
              to={PATHS.PROFILE({ nickname: review.userNickname })}
              query={userByNicknameQuery(review.userNickname)}
              className="font-semibold text-gray-900 hover:underline cursor-pointer flex"
            >
              {review.userName}
            </PrefetchLink>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              @{review.userNickname} • há {formatDistanceToNow(new Date(review.createdAt), { locale: ptBR })}
              {review.updatedAt !== review.createdAt && ' (editado)'}
            </p>
          </div>
        </div>

        {isOwner && (
          <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <PopoverTrigger asChild>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors shrink-0">
                <MoreVertical className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2 rounded-xl shadow-lg border border-gray-100 bg-white z-50">
              <button
                onClick={() => { setIsMenuOpen(false); setShowDeleteConfirm(true); }}
                disabled={deleteMutation.isPending}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir Resenha
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Corpo */}
      <div className="p-5">
        {typeof review.rating === 'number' && review.rating > 0 && (
          <div className="mb-3">
            <StarRating rating={review.rating} size="sm" showLabel={false} />
          </div>
        )}
        {review.title && (
          <h4 className="font-bold text-gray-900 text-lg mb-3 leading-tight">{review.title}</h4>
        )}
        <div
          lang="pt-BR"
          className="prose prose-sm max-w-none prose-p:my-4 prose-p:leading-relaxed prose-img:max-h-[400px] prose-img:object-cover text-gray-800 tiptap-render"
          dangerouslySetInnerHTML={{ __html: review.content }}
        />
      </div>

      <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <LikesAvatarGroup
            reviewId={review.id}
            likesCount={optimisticLikesCount}
            liked={optimisticLiked}
            onLike={() => !likeMutation.isPending && likeMutation.mutate()}
            isPending={likeMutation.isPending}
            authenticated={!!user}
          />
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 text-sm font-semibold transition-colors group ${showComments ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
          >
            <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            <span>{review.commentsCount || 0}</span>
          </button>
        </div>
      </div>

      {showComments && (
        <div className="animate-in slide-in-from-top-2 duration-300 relative z-0">
          <ReviewComments reviewId={review.id} />
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta resenha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir Resenha'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPhotoViewer && review.userPhotoUrl && (
        <PhotoViewer
          imageUrl={review.userPhotoUrl}
          userAvatar={review.userPhotoUrl}
          userName={review.userName || ''}
          userId={review.userId}
          postDate={format(new Date(review.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </div>
  );
};

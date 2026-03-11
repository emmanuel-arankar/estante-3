import React, { useState } from 'react';
import { Review } from '@estante/common-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReviewAPI } from '@/services/reviewsApi';
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

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return deleteReviewAPI(review.id);
        },
        onSuccess: () => {
            toastSuccessClickable('Resenha excluída com sucesso.');
            // Invalida a lista de resenhas e metadados da edição
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['editions'] });
        },
        onError: () => {
            toastErrorClickable('Ocorreu um erro ao excluir a resenha.');
        }
    });

    const isOwner = user?.uid === review.userId;

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:border-gray-200 ${deleteMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Cabecalho - Avatar e Info */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-4">
                <div className="flex gap-3 items-center">
                    <button
                        onClick={() => {
                            if (review.userPhotoUrl) {
                                setShowPhotoViewer(true);
                            }
                        }}
                        className={review.userPhotoUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}
                    >
                        <OptimizedAvatar
                            src={review.userPhotoUrl}
                            alt={`Foto de ${review.userName}`}
                            fallback={review.userName}
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

                {/* Menu de Ações (Apenas Dono) */}
                {isOwner && (
                    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                        <PopoverTrigger asChild>
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors shrink-0">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-48 p-2 rounded-xl shadow-lg border border-gray-100 bg-white z-50">
                            {/* TODO: Implementar rota/estado de edição do frontend */}
                            {/* <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left">
                                <Edit2 className="w-4 h-4" />
                                Editar Resenha
                            </button> */}
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setShowDeleteConfirm(true);
                                }}
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

            {/* Corpo da Resenha */}
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
                    className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-img:max-h-[400px] prose-img:object-cover text-gray-800 tiptap-render"
                    dangerouslySetInnerHTML={{ __html: review.content }}
                />
            </div>

            {/* Rodapé - Ações Sociais */}
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center gap-6">
                <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors group">
                    <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span>{review.likesCount || 0}</span>
                </button>
                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center gap-1.5 text-sm font-semibold transition-colors group ${showComments ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                >
                    <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <span>{review.commentsCount || 0}</span>
                </button>
            </div>

            {/* Expansão Vertical de Comentários */}
            {showComments && (
                <div className="bg-gray-50 animate-in slide-in-from-top-2 duration-300 relative z-0">
                    <ReviewComments reviewId={review.id} />
                </div>
            )}

            {/* Modais Nativos e Padronizados (Deleção em Massa Style) */}
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
                            onClick={(e) => {
                                e.preventDefault();
                                deleteMutation.mutate();
                            }}
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
                    userName={review.userName}
                    userId={review.userId}
                    postDate={format(new Date(review.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    onClose={() => setShowPhotoViewer(false)}
                />
            )}
        </div>
    );
};

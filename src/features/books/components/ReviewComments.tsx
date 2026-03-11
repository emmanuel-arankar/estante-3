import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewCommentsQuery } from '@/features/books/reviews.queries';
import { createReviewCommentAPI } from '@/services/reviewsApi';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { PATHS } from '@/router/paths';
import { userByNicknameQuery } from '@/features/users/user.queries';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, SendHorizontal } from 'lucide-react';

interface ReviewCommentsProps {
    reviewId: string;
}

export const ReviewComments: React.FC<ReviewCommentsProps> = ({ reviewId }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState('');

    const { data: commentsData, isLoading } = useQuery(reviewCommentsQuery(reviewId));

    const mutation = useMutation({
        mutationFn: (text: string) => createReviewCommentAPI(reviewId, { content: text }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId, 'comments'] });
            setNewComment('');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || mutation.isPending) return;
        mutation.mutate(newComment);
    };

    return (
        <div className="bg-gray-50 p-5 border-t border-gray-100">
            {/* Campo para Novo Comentário */}
            {user ? (
                <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
                    <OptimizedAvatar
                        src={user.photoURL || undefined}
                        alt={user.displayName || 'Você'}
                        fallback={user.displayName || '?'}
                        size="md"
                        className="flex-shrink-0"
                    />
                    <div className="flex-1 flex items-center bg-white rounded-full border border-gray-200 overflow-hidden pr-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Escreva um comentário..."
                            className="w-full px-4 text-sm bg-transparent border-none focus:ring-0 outline-none h-10"
                            maxLength={500}
                        />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || mutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-1.5 disabled:opacity-50 transition-colors shadow-sm ml-1"
                        >
                            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="text-sm text-center text-gray-500 mb-6 bg-white p-3 rounded-lg border border-gray-100">
                    Faça login para participar da discussão.
                </div>
            )}

            {/* Fio de Comentários */}
            {isLoading ? (
                <div className="flex justify-center p-4">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    {commentsData?.data.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                            <PrefetchLink
                                to={PATHS.PROFILE({ nickname: comment.userNickname })}
                                query={userByNicknameQuery(comment.userNickname)}
                            >
                                <OptimizedAvatar
                                    src={comment.userPhotoUrl}
                                    alt={comment.userName}
                                    fallback={comment.userName}
                                    size="sm"
                                    className="flex-shrink-0 mt-1"
                                />
                            </PrefetchLink>
                            <div className="flex-1">
                                <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm inline-block">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <PrefetchLink
                                            to={PATHS.PROFILE({ nickname: comment.userNickname })}
                                            query={userByNicknameQuery(comment.userNickname)}
                                            className="font-bold text-gray-900 text-xs hover:underline"
                                        >
                                            {comment.userName}
                                        </PrefetchLink>
                                    </div>
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                                </div>
                                <div className="text-[11px] text-gray-400 mt-1 ml-2">
                                    há {formatDistanceToNow(new Date(comment.createdAt), { locale: ptBR })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {commentsData?.data.length === 0 && (
                        <div className="text-sm text-center text-gray-500 py-4">
                            Nenhum comentário. Seja o primeiro a comentar!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

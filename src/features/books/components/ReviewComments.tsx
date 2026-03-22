import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewCommentsQuery } from '@/features/books/reviews.queries';
import {
    createReviewCommentAPI,
    deleteReviewCommentAPI,
    updateReviewCommentAPI,
    likeReviewCommentAPI,
    getCommentLikersAPI,
} from '@/services/api/reviewsApi';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { PATHS } from '@/router/paths';
import { userByNicknameQuery } from '@/features/users/user.queries';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Reply, Trash2, CornerDownRight, Heart, Pencil, X, MoreHorizontal } from 'lucide-react';
import { ReviewComment } from '@estante/common-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trackEvent } from '@/lib/analytics';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

// ==== ==== TIPOS E HELPERS ==== ====

type SortMode = 'recent' | 'oldest' | 'top';

interface CommentNode extends ReviewComment {
    replies: CommentNode[];
}

function buildCommentTree(comments: ReviewComment[]): CommentNode[] {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];
    for (const c of comments) map.set(c.id, { ...c, replies: [] });
    for (const node of map.values()) {
        if (node.parentCommentId && map.has(node.parentCommentId)) {
            map.get(node.parentCommentId)!.replies.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

function sortRoots(roots: CommentNode[], mode: SortMode): CommentNode[] {
    return [...roots].sort((a, b) => {
        if (mode === 'top') return (b.likesCount || 0) - (a.likesCount || 0);
        if (mode === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}



// ==== ==== AVATAR GROUP DE CURTIDAS (hover popover) ==== ====

interface LikerInfo {
    userId: string; userName: string; userNickname: string; userPhotoUrl: string | null;
}

interface CommentLikesButtonProps {
    reviewId: string;
    commentId: string;
    liked: boolean;
    likesCount: number;
    onLike: () => void;
    isPending: boolean;
    authenticated: boolean;
}

const CommentLikesButton: React.FC<CommentLikesButtonProps> = ({
    reviewId, commentId, liked, likesCount, onLike, isPending, authenticated
}) => {
    const [likers, setLikers] = useState<LikerInfo[]>([]);
    const [loaded, setLoaded] = useState(false);

    const loadLikers = async () => {
        if (loaded || likesCount === 0) return;
        try {
            const res = await getCommentLikersAPI(reviewId, commentId);
            setLikers((res.data || []).slice(0, 3));
            setLoaded(true);
        } catch { /* silencioso */ }
    };

    React.useEffect(() => {
        if (likesCount > 0 && !loaded) {
            loadLikers();
        }
    }, [likesCount, commentId]);

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={authenticated ? onLike : undefined}
                disabled={isPending}
                className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} disabled:opacity-60`}
            >
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-500' : ''}`} />
                {likesCount > 0 && <span className="text-[11px] font-semibold">{likesCount}</span>}
            </button>

            {likesCount > 0 && likers.length > 0 && (
                <div className="flex -space-x-1 ml-0.5">
                    {likers.map((l, i) => (
                        <div key={l.userId || i} style={{ zIndex: likers.length - i }}>
                            <OptimizedAvatar
                                src={l.userPhotoUrl || undefined}
                                alt={l.userName || '?'}
                                fallback={l.userName || '?'}
                                size="xs"
                                className="ring-1 ring-white"
                            />
                        </div>
                    ))}
                    {likesCount > 3 && (
                        <div className="h-4 w-4 rounded-full bg-gray-100 ring-1 ring-white flex items-center justify-center z-0">
                            <span className="text-[8px] font-bold text-gray-500">+{likesCount - 3}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ==== ==== REPLY INPUT INLINE ==== ====

interface ReplyInputProps {
    replyingTo: CommentNode;
    reviewId: string;
    onClose: () => void;
}

const ReplyInput: React.FC<ReplyInputProps> = ({ replyingTo, reviewId, onClose }) => {
    const queryClient = useQueryClient();
    const [text, setText] = useState('');

    const mutation = useMutation({
        mutationFn: (content: string) =>
            createReviewCommentAPI(reviewId, { content, parentCommentId: replyingTo.id }),
        onSuccess: () => {
            trackEvent('comment_created');
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId, 'comments'] });
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            setText('');
            onClose();
        }
    });

    const handleSubmit = () => {
        const hasMedia = /<img/i.test(text);
        if ((!text.trim() && !hasMedia) || mutation.isPending) return;
        mutation.mutate(text);
    };

    return (
        <div className="mt-2 pl-2 border-l-2 border-emerald-200">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mb-1.5">
                <CornerDownRight className="w-3 h-3" />
                Respondendo a <span className="font-bold">@{replyingTo.userNickname}</span>
                <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden w-full">
                <RichTextEditor
                    value={text}
                    onChange={setText}
                    placeholder={`Responder a @${replyingTo.userNickname}...`}
                    onSubmit={handleSubmit}
                    variant="reply"
                    submitLabel={""}
                    className="border-0 shadow-none rounded-none"
                    disabled={mutation.isPending || (!text.trim() && !/<img/i.test(text))}
                />
            </div>
        </div>
    );
};

// ==== ==== CONTEXTO DE CONTROLE GLOBAL DE ABAS ==== ====
interface EditorStateContextType {
    activeReplyId: string | null;
    setActiveReplyId: (id: string | null) => void;
    activeEditId: string | null;
    setActiveEditId: (id: string | null) => void;
}

const EditorStateContext = React.createContext<EditorStateContextType>({
    activeReplyId: null,
    setActiveReplyId: () => { },
    activeEditId: null,
    setActiveEditId: () => { },
});

// ==== ==== ITEM DO COMENTÁRIO ==== ====

interface CommentItemProps {
    comment: CommentNode;
    reviewId: string;
    depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, reviewId, depth = 0 }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { activeReplyId, setActiveReplyId, activeEditId, setActiveEditId } = React.useContext(EditorStateContext);

    const isReplying = activeReplyId === comment.id;
    const isEditing = activeEditId === comment.id;

    const [editText, setEditText] = useState(comment.content);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [optimisticLiked, setOptimisticLiked] = useState(!!(comment as any).isLiked);
    const [optimisticLikesCount, setOptimisticLikesCount] = useState(comment.likesCount || 0);

    // Sincronizar com dados do servidor quando mudarem
    React.useEffect(() => {
        setOptimisticLiked(!!(comment as any).isLiked);
        setOptimisticLikesCount(comment.likesCount || 0);
    }, [(comment as any).isLiked, comment.likesCount]);

    const isOwner = user?.uid === comment.userId;
    const isIndented = depth > 0;
    const wasEdited = comment.updatedAt && comment.createdAt &&
        new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000;

    const deleteMutation = useMutation({
        mutationFn: () => deleteReviewCommentAPI(reviewId, comment.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId, 'comments'] });
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            setShowDeleteConfirm(false);
        }
    });

    const editMutation = useMutation({
        mutationFn: (content: string) => updateReviewCommentAPI(reviewId, comment.id, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId, 'comments'] });
            setActiveEditId(null);
        }
    });

    const likeMutation = useMutation({
        mutationFn: () => likeReviewCommentAPI(reviewId, comment.id),
        onMutate: () => {
            setOptimisticLiked(prev => {
                const next = !prev;
                setOptimisticLikesCount(c => next ? c + 1 : Math.max(0, c - 1));
                return next;
            });
        },
        onSuccess: (data) => {
            if (data.liked) {
                trackEvent('comment_liked');
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

    const handleEditSubmit = () => {
        if (!editText.trim() || editMutation.isPending) return;
        editMutation.mutate(editText);
    };

    return (
        <div className={isIndented ? 'ml-3 sm:ml-6 pl-2 sm:pl-3 border-l-[1.5px] border-gray-100' : ''}>
            <div className={`flex gap-2.5 ${deleteMutation.isPending ? 'opacity-40 pointer-events-none' : ''}`}>
                <PrefetchLink
                    to={PATHS.PROFILE({ nickname: comment.userNickname })}
                    query={userByNicknameQuery(comment.userNickname)}
                    className="flex-shrink-0 mt-0.5"
                >
                    <OptimizedAvatar
                        src={comment.userPhotoUrl || undefined}
                        alt={comment.userName || '?'}
                        fallback={comment.userName || '?'}
                        size="sm"
                    />
                </PrefetchLink>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        /* Modo Edição */
                        <div className="space-y-1">
                            <RichTextEditor
                                value={editText}
                                onChange={setEditText}
                                placeholder="Editar comentário..."
                                onSubmit={handleEditSubmit}
                                variant="reply"
                                submitLabel={editMutation.isPending ? "Salvando..." : "Salvar"}
                                className="-ml-3"
                            />
                            <div className="flex items-center gap-2 ml-1">
                                <button
                                    onClick={() => { setActiveEditId(null); setEditText(comment.content); }}
                                    className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                                >
                                    <X className="w-3 h-3" /> Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Bolha */}
                            <div className="bg-white px-3.5 py-2.5 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm inline-block max-w-full">
                                <PrefetchLink
                                    to={PATHS.PROFILE({ nickname: comment.userNickname })}
                                    query={userByNicknameQuery(comment.userNickname)}
                                    className="font-bold text-gray-900 text-xs hover:underline"
                                >
                                    {comment.userName}
                                </PrefetchLink>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700 text-sm break-words mt-0.5 tiptap-render"
                                    dangerouslySetInnerHTML={{ __html: comment.content }}
                                />
                                {wasEdited && <span className="text-[10px] text-gray-400 italic">(editado)</span>}
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-2.5 mt-1 ml-1">
                                <span className="text-[11px] text-gray-400">
                                    há {formatDistanceToNow(new Date(comment.createdAt), { locale: ptBR })}
                                </span>

                                <CommentLikesButton
                                    reviewId={reviewId}
                                    commentId={comment.id}
                                    liked={optimisticLiked}
                                    likesCount={optimisticLikesCount}
                                    onLike={() => !likeMutation.isPending && likeMutation.mutate()}
                                    isPending={likeMutation.isPending}
                                    authenticated={!!user}
                                />

                                {user && (
                                    <button
                                        onClick={() => {
                                            setActiveReplyId(isReplying ? null : comment.id);
                                            setActiveEditId(null);
                                        }}
                                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                                        title="Responder"
                                    >
                                        <Reply className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                {/* Menu ⋯ do dono */}
                                {isOwner && (
                                    <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                                        <PopoverTrigger asChild>
                                            <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Opções">
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-36 p-1.5 rounded-xl shadow-lg border border-gray-100 bg-white z-50">
                                            <button
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    setActiveEditId(isEditing ? null : comment.id);
                                                    setActiveReplyId(null);
                                                    setEditText(comment.content);
                                                }}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left font-medium"
                                            >
                                                <Pencil className="w-3.5 h-3.5" /> Editar
                                            </button>
                                            <button
                                                onClick={() => { setIsMenuOpen(false); setShowDeleteConfirm(true); }}
                                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                                            </button>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>
                        </>
                    )}

                    {isReplying && (
                        <ReplyInput replyingTo={comment} reviewId={reviewId} onClose={() => setActiveReplyId(null)} />
                    )}

                    {comment.replies.length > 0 && (
                        <div className="mt-3 space-y-3">
                            {comment.replies.map(reply => (
                                <CommentItem key={reply.id} comment={reply} reviewId={reviewId} depth={Math.min(depth + 1, 1)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir comentário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

// ==== ==== COMPONENTE PRINCIPAL ==== ====

interface ReviewCommentsProps {
    reviewId: string;
}

export const ReviewComments: React.FC<ReviewCommentsProps> = ({ reviewId }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [newComment, setNewComment] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('recent');
    const [sortOpen, setSortOpen] = useState(false);

    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const [activeEditId, setActiveEditId] = useState<string | null>(null);

    const { data: commentsData, isLoading } = useQuery(reviewCommentsQuery(reviewId, user?.uid));

    const mutation = useMutation({
        mutationFn: (text: string) => createReviewCommentAPI(reviewId, { content: text }),
        onSuccess: () => {
            trackEvent('comment_created');
            queryClient.invalidateQueries({ queryKey: ['reviews', reviewId, 'comments'] });
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            setNewComment('');
        }
    });

    const handleSubmit = () => {
        const hasMedia = /<img/i.test(newComment);
        if ((!newComment.trim() && !hasMedia) || mutation.isPending) return;
        mutation.mutate(newComment);
    };

    const rawTree = commentsData?.data ? buildCommentTree(commentsData.data) : [];
    const commentTree = sortRoots(rawTree, sortMode);
    const totalCount = commentsData?.data.length ?? 0;

    const sortLabels: Record<SortMode, string> = {
        recent: 'Mais recentes',
        oldest: 'Mais antigas',
        top: 'Mais curtidas',
    };

    return (
        <EditorStateContext.Provider value={{ activeReplyId, setActiveReplyId, activeEditId, setActiveEditId }}>
            <div className="bg-gray-50 p-5 border-t border-gray-100">

                {/* Campo de Novo Comentário */}
                {user ? (
                    <div className="flex gap-3 mb-5">
                        <OptimizedAvatar
                            src={user.photoURL || undefined}
                            alt={user.displayName || 'Você'}
                            fallback={user.displayName || '?'}
                            size="md"
                            className="flex-shrink-0 mt-0.5 hidden xs:block"
                        />
                        <div className="flex-1 min-w-0">
                            <RichTextEditor
                                value={newComment}
                                onChange={setNewComment}
                                placeholder="Escreva um comentário..."
                                onSubmit={handleSubmit}
                                variant="comment"
                                submitLabel={mutation.isPending ? "..." : "Enviar"}
                                className="w-full border-gray-200"
                                disabled={mutation.isPending || (!newComment.trim() && !/<img/i.test(newComment))}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-center text-gray-500 mb-5 bg-white p-3 rounded-xl border border-gray-100">
                        Faça login para participar da discussão.
                    </div>
                )}

                {/* Cabeçalho + Sort Select Moderno */}
                {totalCount > 0 && (
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {totalCount} {totalCount === 1 ? 'comentário' : 'comentários'}
                        </span>

                        {/* Sort — Popover customizado super limpo */}
                        <Popover open={sortOpen} onOpenChange={setSortOpen}>
                            <PopoverTrigger asChild>
                                <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 focus:outline-none transition-colors group">
                                    {sortLabels[sortMode]}
                                    <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-44 p-1.5 rounded-xl shadow-lg border border-gray-100 bg-white z-50">
                                {(['recent', 'oldest', 'top'] as SortMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => { setSortMode(mode); setSortOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${sortMode === mode
                                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                            : 'text-gray-600 hover:bg-gray-50 font-medium'
                                            }`}
                                    >
                                        {sortLabels[mode]}
                                        {sortMode === mode && (
                                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                {/* Lista de Comentários */}
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                ) : commentTree.length > 0 ? (
                    <div className="space-y-4">
                        {commentTree.map(comment => (
                            <CommentItem key={comment.id} comment={comment} reviewId={reviewId} depth={0} />
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-center text-gray-500 py-4">
                        Nenhum comentário. Seja o primeiro a comentar!
                    </div>
                )}
            </div>
        </EditorStateContext.Provider>
    );
};

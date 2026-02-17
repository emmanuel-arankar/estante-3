import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, UserPlus, Clock, RefreshCw } from 'lucide-react';
import { SortDropdown } from '@/components/friends/SortDropdown';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { PrefetchLink } from '@/components/ui/prefetch-link';
import { FriendCardSkeletonList } from '@/components/friends/FriendCardSkeleton';
import { RequestCardSkeletonList } from '@/components/friends/RequestCardSkeleton';
import { userByNicknameQuery } from '@/features/users/user.queries';
import { useDenormalizedFriends } from '@/hooks/useDenormalizedFriends';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/router/paths';
import { DenormalizedFriendship } from '@estante/common-types';
import { getMutualFriendsAPI } from '@/services/friendshipsApi';
import {
  getMutualFriendsFromCache,
  setMutualFriendsCache,
  fetchMutualFriendsDeduped
} from '@/hooks/useMutualFriendsCache';

// Componente para mostrar amigos em comum com avatar group e tooltip
const MutualFriendsIndicator: React.FC<{ userId: string; friendId: string; count: number }> = ({ userId, friendId, count }) => {
  const [avatarFriends, setAvatarFriends] = useState<{ displayName: string; nickname: string; photoURL: string | null }[]>([]);
  const [allFriends, setAllFriends] = useState<{ displayName: string; nickname: string; photoURL: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [avatarsLoading, setAvatarsLoading] = useState(true);

  useEffect(() => {
    // Carregar os primeiros 3 avatares imediatamente
    const loadAvatars = async () => {
      try {
        // Usar função deduplicada para evitar chamadas paralelas duplicadas
        const result = await fetchMutualFriendsDeduped(
          userId,
          friendId,
          () => getMutualFriendsAPI(friendId)
        );
        setAvatarFriends(result.friends.slice(0, 3));
      } catch (error) {
        console.error('Erro ao carregar avatares:', error);
      } finally {
        setAvatarsLoading(false);
      }
    };
    loadAvatars();
  }, [userId, friendId, count]);

  const loadAllFriends = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      // Usar função deduplicada
      const result = await fetchMutualFriendsDeduped(
        userId,
        friendId,
        () => getMutualFriendsAPI(friendId)
      );
      setAllFriends(result.friends);
      setLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar amigos em comum:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayText = count === 1 ? 'amigo em comum' : 'amigos em comum';
  const remaining = count - 3;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className="flex items-center mt-1 cursor-help hover:opacity-80 transition-opacity"
            onMouseEnter={loadAllFriends}
          >
            {/* Avatar Group - primeiros 3 avatares sobrepostos */}
            <div className="flex items-center -space-x-1.5 mr-2">
              {avatarsLoading ? (
                // Skeleton para avatares carregando
                <>
                  {[...Array(Math.min(count, 3))].map((_, index) => (
                    <div
                      key={index}
                      className="relative w-6 h-6 rounded-full bg-gray-200 animate-pulse ring-2 ring-white"
                      style={{ zIndex: 3 - index }}
                    />
                  ))}
                </>
              ) : (
                <>
                  {avatarFriends.map((friend, index) => (
                    <div key={index} className="relative" style={{ zIndex: 3 - index }}>
                      <OptimizedAvatar
                        src={friend.photoURL || undefined}
                        alt={friend.displayName}
                        fallback={friend.displayName}
                        size="xs"
                        className="ring-2 ring-white"
                      />
                    </div>
                  ))}
                  {/* Indicador +X se houver mais de 3 */}
                  {remaining > 0 && (
                    <div
                      className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 ring-2 ring-white text-[10px] font-semibold text-gray-700"
                      style={{ zIndex: 0 }}
                    >
                      +{remaining}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {count} {displayText}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {loading ? (
            <p className="text-sm">Carregando...</p>
          ) : allFriends.length > 0 ? (
            <ul className="text-sm space-y-1">
              {allFriends.map((friend, index) => (
                <li key={index}>{friend.displayName}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{count} {displayText}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Componente auxiliar para calcular amigos em comum dinamicamente
const DynamicMutualFriendsIndicator: React.FC<{ userId: string; friendId: string }> = ({ userId, friendId }) => {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Começa a carregar 100px antes de entrar na tela
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const loadCount = async () => {
      setLoading(true);
      try {
        // Usar função deduplicada para evitar chamadas paralelas duplicadas
        const result = await fetchMutualFriendsDeduped(
          userId,
          friendId,
          () => getMutualFriendsAPI(friendId)
        );
        setCount(result.count > 0 ? result.count : null);
      } catch (error) {
        console.error('Erro ao calcular amigos em comum:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCount();
  }, [userId, friendId, isVisible]);

  // Mostrar skeleton enquanto carrega
  if (loading || !isVisible) {
    return (
      <div ref={ref} className="flex items-center mt-1 space-x-2">
        <div className="flex items-center -space-x-1.5">
          {[...Array(2)].map((_, index) => (
            <div
              key={index}
              className="w-6 h-6 rounded-full bg-gray-200 animate-pulse ring-2 ring-white"
              style={{ zIndex: 2 - index }}
            />
          ))}
        </div>
        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!count) return null;

  return <MutualFriendsIndicator userId={userId} friendId={friendId} count={count} />;
};

// # atualizado: FriendCard com PrefetchLink e amigos em comum (usa valor armazenado)
const FriendCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; userId: string; onAction: (id: string) => void }>(
  ({ friendship, userId, onAction }, ref) => {
    const { friend, friendId, mutualFriendsCount } = friendship;

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col h-full"
      >
        <div className="flex items-start space-x-3 mb-3">
          <OptimizedAvatar
            src={friend.photoURL}
            alt={friend.displayName}
            fallback={friend.displayName}
            size="md"
            className="flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              <PrefetchLink
                to={PATHS.PROFILE({ nickname: friend.nickname })}
                query={userByNicknameQuery(friend.nickname)}
                className="hover:text-emerald-600 transition-colors"
              >
                {friend.displayName}
              </PrefetchLink>
            </h3>
            <p className="text-sm text-gray-600 truncate">@{friend.nickname}</p>
            {/* Usa valor armazenado, fallback para API se não existir */}
            {mutualFriendsCount !== undefined && mutualFriendsCount > 0 ? (
              <MutualFriendsIndicator userId={userId} friendId={friendId} count={mutualFriendsCount} />
            ) : mutualFriendsCount === undefined ? (
              <DynamicMutualFriendsIndicator userId={userId} friendId={friendId} />
            ) : null}
          </div>
        </div>

        {friendship.friendshipDate && (
          <p className="text-xs text-gray-500 mt-auto mb-3">
            Amigos desde {formatDistanceToNow(friendship.friendshipDate, { addSuffix: true, locale: ptBR })}
          </p>
        )}

        <Button variant="outline" size="sm" onClick={() => onAction(friendship.id)} className="w-full mt-auto">
          Remover
        </Button>
      </motion.div>
    );
  }
);

// # atualizado: RequestCard com PrefetchLink, amigos em comum sempre dinâmico
// Para solicitações pendentes, sempre buscamos dinamicamente para garantir precisão
const RequestCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; userId: string; onAccept: (id: string) => void; onReject: (id: string) => void }>(
  ({ friendship, userId, onAccept, onReject }, ref) => {
    const { friend, friendId } = friendship;

    return (
      <motion.div ref={ref} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col h-full">
        <div className="flex items-start space-x-3 mb-3">
          <OptimizedAvatar src={friend.photoURL} alt={friend.displayName} fallback={friend.displayName} size="md" className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              <PrefetchLink
                to={PATHS.PROFILE({ nickname: friend.nickname })}
                query={userByNicknameQuery(friend.nickname)}
                className="hover:text-emerald-600 transition-colors"
              >
                {friend.displayName}
              </PrefetchLink>
            </h3>
            <p className="text-sm text-gray-600 truncate">@{friend.nickname}</p>
            {/* Para pending, sempre busca dinamicamente para garantir precisão */}
            <DynamicMutualFriendsIndicator userId={userId} friendId={friendId} />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3 mt-auto">Enviado {formatDistanceToNow(friendship.createdAt, { addSuffix: true, locale: ptBR })}</p>
        <div className="flex space-x-2">
          <Button size="sm" onClick={() => onAccept(friendship.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Aceitar</Button>
          <Button variant="outline" size="sm" onClick={() => onReject(friendship.id)} className="flex-1">Recusar</Button>
        </div>
      </motion.div>
    );
  }
);

// # atualizado: SentRequestCard com PrefetchLink, amigos em comum sempre dinâmico
// Para solicitações pendentes, sempre buscamos dinamicamente para garantir precisão
const SentRequestCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; userId: string; onCancel: (id: string) => void }>(
  ({ friendship, userId, onCancel }, ref) => {
    const { friend, friendId } = friendship;

    return (
      <motion.div ref={ref} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col h-full">
        <div className="flex items-start space-x-3 mb-3">
          <OptimizedAvatar src={friend.photoURL} alt={friend.displayName} fallback={friend.displayName} size="md" className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              <PrefetchLink
                to={PATHS.PROFILE({ nickname: friend.nickname })}
                query={userByNicknameQuery(friend.nickname)}
                className="hover:text-emerald-600 transition-colors"
              >
                {friend.displayName}
              </PrefetchLink>
            </h3>
            <p className="text-sm text-gray-600 truncate">@{friend.nickname}</p>
            {/* Para pending, sempre busca dinamicamente para garantir precisão */}
            <DynamicMutualFriendsIndicator userId={userId} friendId={friendId} />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3 mt-auto">Enviado {formatDistanceToNow(friendship.createdAt, { addSuffix: true, locale: ptBR })}</p>
        <Button variant="outline" size="sm" className="w-full mt-auto" onClick={() => onCancel(friendship.id)}>Cancelar</Button>
      </motion.div>
    );
  }
);

// # atualizado: FriendListItem com PrefetchLink e amigos em comum (usa valor armazenado)
const FriendListItem = ({ friendship, userId, onAction }: { friendship: DenormalizedFriendship; userId: string; onAction: (id: string) => void }) => (
  <motion.div
    layout
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
  >
    <div className="flex items-center space-x-4">
      <OptimizedAvatar src={friendship.friend.photoURL} alt={friendship.friend.displayName} fallback={friendship.friend.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <PrefetchLink
          to={PATHS.PROFILE({ nickname: friendship.friend.nickname })}
          query={userByNicknameQuery(friendship.friend.nickname)}
          className="font-semibold text-gray-900 truncate hover:text-emerald-600"
        >
          {friendship.friend.displayName}
        </PrefetchLink>
        <p className="text-sm text-gray-600 truncate">@{friendship.friend.nickname}</p>
        {/* Usa valor armazenado, fallback para API se não existir */}
        {friendship.mutualFriendsCount !== undefined && friendship.mutualFriendsCount > 0 ? (
          <MutualFriendsIndicator userId={userId} friendId={friendship.friendId} count={friendship.mutualFriendsCount} />
        ) : friendship.mutualFriendsCount === undefined ? (
          <DynamicMutualFriendsIndicator userId={userId} friendId={friendship.friendId} />
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={() => onAction(friendship.id)}>Remover</Button>
    </div>
  </motion.div>
);

// # atualizado: RequestListItem com PrefetchLink, amigos em comum e tooltip
const RequestListItem = ({ friendship, userId, onAccept, onReject }: { friendship: DenormalizedFriendship; userId: string; onAccept: (id: string) => void; onReject: (id: string) => void }) => (
  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center space-x-4">
      <OptimizedAvatar src={friendship.friend.photoURL} alt={friendship.friend.displayName} fallback={friendship.friend.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <PrefetchLink
          to={PATHS.PROFILE({ nickname: friendship.friend.nickname })}
          query={userByNicknameQuery(friendship.friend.nickname)}
          className="font-semibold text-gray-900 truncate hover:text-emerald-600"
        >
          {friendship.friend.displayName}
        </PrefetchLink>
        <p className="text-sm text-gray-600 truncate">@{friendship.friend.nickname}</p>
        {/* Usa valor armazenado, fallback para API se não existir */}
        {friendship.mutualFriendsCount !== undefined && friendship.mutualFriendsCount > 0 ? (
          <MutualFriendsIndicator userId={userId} friendId={friendship.friendId} count={friendship.mutualFriendsCount} />
        ) : friendship.mutualFriendsCount === undefined ? (
          <DynamicMutualFriendsIndicator userId={userId} friendId={friendship.friendId} />
        ) : null}
      </div>
      <div className="flex space-x-2">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAccept(friendship.id)}>Aceitar</Button>
        <Button variant="outline" size="sm" onClick={() => onReject(friendship.id)}>Recusar</Button>
      </div>
    </div>
  </motion.div>
);

// # atualizado: SentRequestListItem com PrefetchLink, amigos em comum e tooltip
const SentRequestListItem = ({ friendship, userId, onCancel }: { friendship: DenormalizedFriendship; userId: string; onCancel: (id: string) => void }) => (
  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center space-x-4">
      <OptimizedAvatar src={friendship.friend.photoURL} alt={friendship.friend.displayName} fallback={friendship.friend.displayName} size="md" />
      <div className="flex-1 min-w-0">
        <PrefetchLink
          to={PATHS.PROFILE({ nickname: friendship.friend.nickname })}
          query={userByNicknameQuery(friendship.friend.nickname)}
          className="font-semibold text-gray-900 truncate hover:text-emerald-600"
        >
          {friendship.friend.displayName}
        </PrefetchLink>
        <p className="text-sm text-gray-600 truncate">@{friendship.friend.nickname}</p>
        {/* Usa valor armazenado, fallback para API se não existir */}
        {friendship.mutualFriendsCount !== undefined && friendship.mutualFriendsCount > 0 ? (
          <MutualFriendsIndicator userId={userId} friendId={friendship.friendId} count={friendship.mutualFriendsCount} />
        ) : friendship.mutualFriendsCount === undefined ? (
          <DynamicMutualFriendsIndicator userId={userId} friendId={friendship.friendId} />
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={() => onCancel(friendship.id)}>Cancelar</Button>
    </div>
  </motion.div>
);

// Estado Vazio e Ações em Massa
const EmptyState = ({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>, title: string, description: string }) => (
  <div className="text-center py-12"><Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3><p className="text-gray-600">{description}</p></div>
);

const BulkActions = ({ onAction, actionLabel, count, variant = 'default', loading = false, disabled = false }: { onAction: () => void, actionLabel: string, count: number, variant?: 'default' | 'destructive', loading?: boolean, disabled?: boolean }) => {
  if (count === 0) return null;
  return (<Button variant={variant === 'destructive' ? 'destructive' : 'outline'} size="sm" onClick={onAction} className="ml-auto" disabled={disabled || loading}>{loading ? <><LoadingSpinner size="sm" className="mr-2" />Processando...</> : `${actionLabel} todos (${count})`}</Button>);
};

const RequestsBulkActions = ({ onAcceptAll, onRejectAll, count, loading = false, disabled = false }: { onAcceptAll: () => void, onRejectAll: () => void, count: number, loading?: boolean, disabled?: boolean }) => {
  if (count === 0) return null;
  return (
    <div className="flex items-center space-x-2">
      <Button size="sm" onClick={onAcceptAll} className="bg-emerald-600 hover:bg-emerald-700" disabled={disabled || loading}>
        {loading ? <><LoadingSpinner size="sm" className="mr-2" />Processando...</> : `Aceitar todas (${count})`}
      </Button>
      <Button variant="outline" size="sm" onClick={onRejectAll} disabled={disabled || loading}>
        {loading ? <><LoadingSpinner size="sm" className="mr-2" />Processando...</> : `Recusar todas (${count})`}
      </Button>
    </div>
  );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, count, loading }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, count: number, loading: boolean }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir todas as {count} solicitações enviadas? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">{loading ? 'Excluindo...' : 'Excluir Todos'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const AcceptAllConfirmationModal = ({ isOpen, onClose, onConfirm, count, loading }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, count: number, loading: boolean }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirmar aceitação</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja aceitar todas as {count} solicitações de amizade? Todas essas pessoas se tornarão seus amigos.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">{loading ? 'Aceitando...' : `Aceitar ${count} Solicitações`}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const RejectAllConfirmationModal = ({ isOpen, onClose, onConfirm, count, loading }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, count: number, loading: boolean }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirmar recusa</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja recusar todas as {count} solicitações de amizade? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">{loading ? 'Recusando...' : `Recusar ${count} Solicitações`}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// Componente Principal
export const DenormalizedFriendsList: React.FC = () => {
  const { viewMode } = useOutletContext<{ viewMode: 'grid' | 'list' }>();
  const location = useLocation();
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showAcceptAllConfirm, setShowAcceptAllConfirm] = useState(false);
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const {
    friends,
    requests,
    sentRequests,
    stats,
    loading,
    loadingMore,
    error,
    hasMoreFriends,
    searchQuery, setSearchQuery,
    sortField, setSortField,
    sortDirection, setSortDirection,
    loadMoreFriends,
    refreshData,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    cancelSentRequest,
    cancelAllSentRequests,
    acceptAllRequests,
    rejectAllRequests
  } = useDenormalizedFriends();

  const activeTab = useMemo(() => {
    const pathSegments = location.pathname.split('/');
    return pathSegments[2] || 'friends';
  }, [location.pathname]);

  const handleDeleteAllSentRequests = async () => {
    setShowDeleteConfirm(false); setIsDeletingAll(true);
    try { await cancelAllSentRequests(); }
    catch (error) { console.error('Erro ao excluir todas as solicitações:', error); }
    finally { setIsDeletingAll(false); }
  };

  const handleAcceptAllRequests = async () => {
    setShowAcceptAllConfirm(false); setIsProcessingAll(true);
    try { await acceptAllRequests(); }
    catch (error) { console.error('Erro ao aceitar todas as solicitações:', error); }
    finally { setIsProcessingAll(false); }
  };

  const handleRejectAllRequests = async () => {
    setShowRejectAllConfirm(false); setIsProcessingAll(true);
    try { await rejectAllRequests(); }
    catch (error) { console.error('Erro ao recusar todas as solicitações:', error); }
    finally { setIsProcessingAll(false); }
  };

  // Loading inicial com skeletons
  if (loading && friends.length === 0 && requests.length === 0 && sentRequests.length === 0) {
    return (
      <div className="space-y-6">
        {/* Barra de busca skeleton */}
        <div className="h-10 bg-gray-200 rounded animate-pulse" />

        {/* Skeleton list baseado na aba ativa */}
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
          </CardHeader>
          <CardContent>
            {activeTab === 'requests' ? (
              <RequestCardSkeletonList count={3} />
            ) : (
              <FriendCardSkeletonList count={5} />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-[400px] flex flex-col items-center justify-center"><p className="text-red-600 mb-4">{error}</p><Button onClick={refreshData}>Tentar novamente</Button></div>;
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
        <Input type="text" placeholder="Buscar por nome ou alcunha..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-white border-gray-300 rounded-full" />
      </div>

      {activeTab === 'friends' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{searchQuery ? 'Amigos encontrados' : 'Todos os amigos'}<span className="text-sm font-normal text-gray-500 ml-2">({searchQuery ? friends.length : stats.totalFriends})</span></CardTitle>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <SortDropdown sortBy={sortField} sortDirection={sortDirection} onSortChange={(field, direction) => { setSortField(field); setSortDirection(direction); }} />
              <Button onClick={refreshData} variant="outline" size="icon" className="h-8 w-8" title="Recarregar amigos"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? <EmptyState icon={Users} title={searchQuery ? 'Nenhum amigo encontrado' : 'Nenhum amigo ainda'} description={searchQuery ? 'Tente buscar por outro termo' : 'Comece adicionando amigos'} /> : (
              <>
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                  <AnimatePresence>
                    {friends.map((friendship) => (
                      viewMode === 'grid'
                        ? <FriendCard key={friendship.id} friendship={friendship} userId={user?.uid || ''} onAction={removeFriend} />
                        : <FriendListItem key={friendship.id} friendship={friendship} userId={user?.uid || ''} onAction={removeFriend} />
                    ))}
                  </AnimatePresence>
                </div>
                {hasMoreFriends && !searchQuery && friends.length > 0 && (
                  <div className="text-center mt-6">
                    <Button onClick={loadMoreFriends} variant="outline" disabled={loadingMore}>{loadingMore ? <><LoadingSpinner size="sm" className="mr-2" />Carregando...</> : 'Carregar mais amigos'}</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{searchQuery ? 'Solicitações encontradas' : 'Solicitações recebidas'}<span className="text-sm font-normal text-gray-500 ml-2">({requests.length})</span></CardTitle>
            <RequestsBulkActions
              onAcceptAll={() => setShowAcceptAllConfirm(true)}
              onRejectAll={() => setShowRejectAllConfirm(true)}
              count={requests.length}
              loading={isProcessingAll}
              disabled={requests.length === 0}
            />
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? <EmptyState icon={UserPlus} title={searchQuery ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação pendente'} description={searchQuery ? 'Tente buscar por outro termo' : 'Quando alguém enviar uma solicitação, ela aparecerá aqui'} /> : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                <AnimatePresence>
                  {requests.map((friendship) => (
                    viewMode === 'grid'
                      ? <RequestCard key={friendship.id} friendship={friendship} userId={user?.uid || ''} onAccept={acceptFriendRequest} onReject={rejectFriendRequest} />
                      : <RequestListItem key={friendship.id} friendship={friendship} userId={user?.uid || ''} onAccept={acceptFriendRequest} onReject={rejectFriendRequest} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'sent' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{searchQuery ? 'Solicitações encontradas' : 'Solicitações enviadas'}<span className="text-sm font-normal text-gray-500 ml-2">({sentRequests.length})</span></CardTitle>
            <BulkActions onAction={() => setShowDeleteConfirm(true)} actionLabel="Excluir" count={sentRequests.length} variant="destructive" disabled={sentRequests.length === 0} />
          </CardHeader>
          <CardContent>
            {sentRequests.length === 0 ? <EmptyState icon={Clock} title={searchQuery ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação enviada'} description={searchQuery ? 'Tente buscar por outro termo' : 'Solicitações que você enviou aparecerão aqui'} /> : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                <AnimatePresence>
                  {sentRequests.map((friendship) => (
                    viewMode === 'grid'
                      ? <SentRequestCard key={friendship.id} friendship={friendship} userId={user?.uid || ''} onCancel={cancelSentRequest} />
                      : <SentRequestListItem key={friendship.id} friendship={friendship} userId={user?.uid || ''} onCancel={cancelSentRequest} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteAllSentRequests} count={sentRequests.length} loading={isDeletingAll} />
      <AcceptAllConfirmationModal isOpen={showAcceptAllConfirm} onClose={() => setShowAcceptAllConfirm(false)} onConfirm={handleAcceptAllRequests} count={requests.length} loading={isProcessingAll} />
      <RejectAllConfirmationModal isOpen={showRejectAllConfirm} onClose={() => setShowRejectAllConfirm(false)} onConfirm={handleRejectAllRequests} count={requests.length} loading={isProcessingAll} />
    </div>
  );
};
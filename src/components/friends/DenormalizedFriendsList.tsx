import React, { useState, useMemo } from 'react';
import { useLocation, useOutletContext, Link } from 'react-router-dom';
import { 
  Search, 
  Users, 
  UserPlus, 
  Clock, 
  RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useDenormalizedFriends } from '../../hooks/useDenormalizedFriends';
import { DenormalizedFriendship } from '../../models/friendship';
import { formatDistanceToNow } from 'date-fns';
import { SortDropdown } from './SortDropdown';
import { ptBR } from 'date-fns/locale';
import { PATHS } from '../../router/paths';
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
import { PrefetchLink } from '../ui/prefetch-link';
import { userByNicknameQuery } from '@/features/users/user.queries';

// # atualizado: FriendCard com PrefetchLink
const FriendCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; onAction: (id: string) => void }>(
  ({ friendship, onAction }, ref) => {
    const { friend } = friendship;
    
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

// # atualizado: RequestCard com PrefetchLink
const RequestCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; onAccept: (id: string) => void; onReject: (id: string) => void }>(
  ({ friendship, onAccept, onReject }, ref) => {
    const { friend } = friendship;
    
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

// # atualizado: SentRequestCard com PrefetchLink
const SentRequestCard = React.forwardRef<HTMLDivElement, { friendship: DenormalizedFriendship; onCancel: (id: string) => void }>(
  ({ friendship, onCancel }, ref) => {
    const { friend } = friendship;
    
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
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3 mt-auto">Enviado {formatDistanceToNow(friendship.createdAt, { addSuffix: true, locale: ptBR })}</p>
        <Button variant="secondary" size="sm" className="w-full" onClick={() => onCancel(friendship.id)}>Cancelar</Button>
      </motion.div>
    );
  }
);

// # atualizado: FriendListItem com PrefetchLink
const FriendListItem = ({ friendship, onAction }: { friendship: DenormalizedFriendship; onAction: (id: string) => void }) => (
  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
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
    </div>
    <Button variant="outline" size="sm" onClick={() => onAction(friendship.id)}>Remover</Button>
  </motion.div>
);

// # atualizado: RequestListItem com PrefetchLink
const RequestListItem = ({ friendship, onAccept, onReject }: { friendship: DenormalizedFriendship; onAccept: (id: string) => void; onReject: (id: string) => void }) => (
  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
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
    </div>
    <div className="flex space-x-2">
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAccept(friendship.id)}>Aceitar</Button>
      <Button variant="outline" size="sm" onClick={() => onReject(friendship.id)}>Recusar</Button>
    </div>
  </motion.div>
);

// # atualizado: SentRequestListItem com PrefetchLink
const SentRequestListItem = ({ friendship, onCancel }: { friendship: DenormalizedFriendship; onCancel: (id: string) => void }) => (
  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
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
    </div>
    <Button variant="secondary" size="sm" onClick={() => onCancel(friendship.id)}>Cancelar</Button>
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

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, count, loading }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, count: number, loading: boolean }) => (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir todas as {count} solicitações enviadas? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">{loading ? 'Excluindo...' : 'Excluir Todos'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
);

// Componente Principal
export const DenormalizedFriendsList: React.FC = () => {
  const { viewMode } = useOutletContext<{ viewMode: 'grid' | 'list' }>();
  const location = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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
    cancelAllSentRequests
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

  if (loading && friends.length === 0 && requests.length === 0 && sentRequests.length === 0) {
    return <div className="min-h-[400px] flex flex-col items-center justify-center"><LoadingSpinner size="lg" /><p className="mt-4 text-gray-600">Carregando...</p></div>;
  }
  
  if (error) {
    return <div className="min-h-[400px] flex flex-col items-center justify-center"><p className="text-red-600 mb-4">{error}</p><Button onClick={refreshData}>Tentar novamente</Button></div>;
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input type="text" placeholder="Buscar por nome ou alcunha..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      {activeTab === 'friends' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{searchQuery ? 'Amigos encontrados' : 'Todos os amigos'}<span className="text-sm font-normal text-gray-500 ml-2">({friends.length})</span></CardTitle>
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
                        ? <FriendCard key={friendship.id} friendship={friendship} onAction={removeFriend} />
                        : <FriendListItem key={friendship.id} friendship={friendship} onAction={removeFriend} />
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
            <CardTitle className="text-lg">Solicitações recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? <EmptyState icon={UserPlus} title={searchQuery ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação pendente'} description={searchQuery ? 'Tente buscar por outro termo' : 'Quando alguém enviar uma solicitação, ela aparecerá aqui'} /> : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                <AnimatePresence>
                  {requests.map((friendship) => (
                    viewMode === 'grid'
                      ? <RequestCard key={friendship.id} friendship={friendship} onAccept={acceptFriendRequest} onReject={rejectFriendRequest} />
                      : <RequestListItem key={friendship.id} friendship={friendship} onAccept={acceptFriendRequest} onReject={rejectFriendRequest} />
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
            <CardTitle className="text-lg">Solicitações enviadas</CardTitle>
            <BulkActions onAction={() => setShowDeleteConfirm(true)} actionLabel="Excluir" count={sentRequests.length} variant="destructive" disabled={sentRequests.length === 0} />
          </CardHeader>
          <CardContent>
            {sentRequests.length === 0 ? <EmptyState icon={Clock} title={searchQuery ? 'Nenhuma solicitação encontrada' : 'Nenhuma solicitação enviada'} description={searchQuery ? 'Tente buscar por outro termo' : 'Solicitações que você enviou aparecerão aqui'} /> : (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                <AnimatePresence>
                  {sentRequests.map((friendship) => (
                     viewMode === 'grid'
                      ? <SentRequestCard key={friendship.id} friendship={friendship} onCancel={cancelSentRequest} />
                      : <SentRequestListItem key={friendship.id} friendship={friendship} onCancel={cancelSentRequest} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteAllSentRequests} count={sentRequests.length} loading={isDeletingAll} />
    </div>
  );
};
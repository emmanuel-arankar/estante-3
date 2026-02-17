import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Plus, MoreVertical, Check, CheckCheck, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageMetadata } from '@/common/PageMetadata';
import { OnlineStatus } from '@/components/chat/OnlineStatus';
import { NewConversationModal } from '@/components/chat/NewConversationModal';
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { PATHS } from '@/router/paths';
import { deleteChat } from '@/services/realtime';
import { useQuery } from '@tanstack/react-query';
import { userProfileQuery } from '@/features/users/userProfile.queries';

interface ConversationItemProps {
  chat: any;
  user: any;
  onDelete: (otherUserId: string) => Promise<void>;
}

const ConversationItem = ({ chat, user, onDelete }: ConversationItemProps) => {
  const { getAnonymizedUser } = useBlockedUsers();

  // Usar endpoint protegido que verifica bloqueio ANTES de retornar dados
  const { data: otherUser, error } = useQuery({
    ...userProfileQuery(chat.otherUserId),
    enabled: !!chat.otherUserId,
  });

  // Se erro (403 = bloqueado) ou EU bloqueei ele, mostrar genérico
  const anonymizedData = getAnonymizedUser(chat.otherUserId);
  const wasBlockedByUser = error !== null;

  // IMPORTANTE: Não usar dados denormalizados (chat.displayName/photoURL) quando bloqueado
  // Esses dados contêm informações reais e vazam privacidade
  const displayName = anonymizedData?.displayName
    || (wasBlockedByUser ? 'Usuário' : otherUser?.displayName)
    || 'Usuário';

  const photoURL = (anonymizedData?.isBlocked || wasBlockedByUser)
    ? undefined
    : otherUser?.photoURL;

  return (
    <Link
      to={PATHS.CHAT({ receiverId: chat.otherUserId })}
      state={{ recipient: otherUser }}
      className="block hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center space-x-4 p-4">
        <div className="relative">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUserId}`}
              alt={displayName}
            />
            <AvatarFallback>
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <OnlineStatus
            userId={chat.otherUserId}
            className="absolute -bottom-1 -right-1"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {displayName}
            </h3>
            <div className="flex items-center space-x-2">
              {chat.lastMessageTime && (
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(chat.lastMessageTime, {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              )}
              {chat.unreadCount > 0 && (
                <Badge className="bg-emerald-600 text-white rounded-full min-w-[20px] h-5 flex items-center justify-center text-xs">
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-sm text-gray-600 truncate max-w-xs">
              {chat.lastSenderId === user.uid && (
                <>
                  {chat.lastMessageRead ? (
                    <CheckCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Check className="h-3 w-3 text-gray-400 shrink-0" />
                  )}
                  <span className="font-medium mr-1">Você:</span>
                </>
              )}
              <span className="truncate">
                {chat.lastMessage || 'Nenhuma mensagem ainda'}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm('Excluir esta conversa?')) {
                      onDelete(chat.otherUserId);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Conversa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Link>
  );
};

export const Messages = () => {
  const { user } = useAuth();
  const { chats, loading } = useChat();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  const handleDeleteChat = async (otherUserId: string) => {
    if (!user) return;
    try {
      await deleteChat(user.uid, otherUserId);
    } catch (error) {
      console.error("Erro ao deletar chat:", error);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate(PATHS.LOGIN);
    }
  }, [user, navigate]);

  const filteredChats = chats
    .filter(chat => {
      const name = chat.displayName || `Usuário ${chat.otherUserId?.slice(0, 8) || '...'}`;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      // Helper to safely get milliseconds
      const getTimeInMillis = (time: any): number => {
        if (!time) return 0;
        if (typeof time.toMillis === 'function') return time.toMillis();
        if (time instanceof Date) return time.getTime();
        if (typeof time === 'number') return time;
        if (time.seconds) return time.seconds * 1000; // Serialized timestamp
        if (typeof time === 'string') return new Date(time).getTime();
        return 0;
      };

      const timeA = getTimeInMillis(a.lastMessageTime);
      const timeB = getTimeInMillis(b.lastMessageTime);
      return timeB - timeA;
    });

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title="Mensagens"
        description="Veja suas conversas privadas na Estante de Bolso."
        noIndex={true}
      />

      <main className="h-[calc(100vh-80px)] w-full max-w-6xl mx-auto px-4 pt-8 pb-8 flex flex-col">
        <div className="shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Mensagens</h1>
              <p className="text-gray-600">
                {loading ? 'Carregando...' : `${chats.length} ${chats.length === 1 ? 'conversa ativa' : 'conversas ativas'}`}
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 rounded-full"
              onClick={() => setShowNewConversationModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Conversa
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200 rounded-full"
            />
          </div>
        </div>

        {/* Chat List */}
        <Card className="flex-1 overflow-hidden border-none shadow-sm flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-gray-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                    {/* Avatar skeleton */}
                    <div className="shrink-0 w-14 h-14 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      {/* Nome skeleton */}
                      <div className="h-4 bg-gray-200 rounded-full w-32" />
                      {/* Mensagem skeleton */}
                      <div className="h-3 bg-gray-200 rounded-full w-48" />
                    </div>
                    {/* Timestamp skeleton */}
                    <div className="h-3 bg-gray-200 rounded-full w-12" />
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-gray-100 rounded-full p-6 mb-4">
                  <MessageCircle className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery
                    ? 'Tente buscar por outro termo'
                    : 'Comece uma nova conversa com outros leitores'
                  }
                </p>
                {!searchQuery && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowNewConversationModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Iniciar Conversa
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredChats.map((chat, index) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ConversationItem
                      chat={chat}
                      user={user}
                      onDelete={handleDeleteChat}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Nova Conversa */}
        <NewConversationModal
          isOpen={showNewConversationModal}
          onClose={() => setShowNewConversationModal(false)}
        />
      </main>
    </>
  );
};
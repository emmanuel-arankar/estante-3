import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Plus, MoreVertical } from 'lucide-react';
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
import { PATHS } from '@/router/paths';

export const Messages = () => {
  const { user } = useAuth();
  const { chats, loading } = useChat();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate(PATHS.LOGIN);
    }
  }, [user, navigate]);

  const filteredChats = chats.filter(chat =>
    chat.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <main className="min-h-[calc(100vh-80px)] bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Mensagens</h1>
                <p className="text-gray-600">
                  {chats.length} conversas ativas
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

            {/* Chat List */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
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
                        <Link
                          to={PATHS.CHAT({ receiverId: chat.otherUserId })}
                          className="block hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-4 p-4">
                            <div className="relative">
                              <Avatar className="h-12 w-12">
                                <AvatarImage
                                  src={chat.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUserId}`}
                                  alt={chat.displayName}
                                />
                                <AvatarFallback>
                                  {chat.displayName?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <OnlineStatus
                                isOnline={chat.online}
                                className="absolute -bottom-1 -right-1"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {chat.displayName || `Usuário ${chat.otherUserId.slice(0, 8)}`}
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
                                <p className="text-sm text-gray-600 truncate max-w-xs">
                                  {chat.lastMessage || 'Nenhuma mensagem ainda'}
                                </p>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Modal de Nova Conversa */}
          <NewConversationModal
            isOpen={showNewConversationModal}
            onClose={() => setShowNewConversationModal(false)}
          />
        </div>
      </main>
    </>
  );
};
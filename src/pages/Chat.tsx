import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Video, MoreVertical, Search } from 'lucide-react';
import { PageMetadata } from '@/common/PageMetadata';
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { OnlineStatus } from '@/components/chat/OnlineStatus';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/router/paths';
import { User } from '@estante/common-types';

export const Chat = () => {
  const { receiverId } = useParams<{ receiverId: string }>();
  const { user } = useAuth();
  const { state } = useLocation();
  const recipient = state?.recipient as User | undefined; 
  const navigate = useNavigate();
  const { messages, loading, sendMessage } = useChat(receiverId);
  const [receiverInfo, setReceiverInfo] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate(PATHS.LOGIN);
      return;
    }

    if (!receiverId) {
      navigate(PATHS.MESSAGES);
      return;
    }

    // Carregar informações do destinatário
    // TODO: Implementar busca de usuário por ID
    setReceiverInfo({
      id: receiverId,
      displayName: `Usuário ${receiverId.slice(0, 8)}`,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiverId}`,
      online: true,
      lastSeen: new Date(),
    });
  }, [user, receiverId, navigate]);

  const handleSendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    await sendMessage(content, type);
  };

  if (!user || !receiverId) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <PageMetadata
        title={recipient ? `Chat com ${recipient.displayName}` : 'Chat'}
        description={`Conversa com ${recipient?.displayName || 'um usuário'}.`}
        noIndex={true}
      />
      
      <main className="min-h-[calc(100vh-80px)] bg-gray-50">
        <div className="max-w-4xl mx-auto bg-white shadow-sm">
          {/* Header do Chat */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-20 z-10">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={receiverInfo?.photoURL} alt={receiverInfo?.displayName} />
                    <AvatarFallback>
                      {receiverInfo?.displayName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineStatus isOnline={receiverInfo?.online} className="absolute -bottom-1 -right-1" />
                </div>

                <div>
                  <h1 className="font-semibold text-gray-900">
                    {receiverInfo?.displayName || 'Carregando...'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {receiverInfo?.online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Phone className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Video className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Search className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex flex-col h-[calc(100vh-200px)]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-gray-100 rounded-full p-6 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={receiverInfo?.photoURL} alt={receiverInfo?.displayName} />
                      <AvatarFallback className="text-2xl">
                        {receiverInfo?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Comece uma conversa com {receiverInfo?.displayName}
                  </h3>
                  <p className="text-gray-500">
                    Envie uma mensagem para iniciar o chat
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ChatMessage
                        message={message}
                        isOwn={message.senderId === user.uid}
                        showAvatar={
                          index === 0 ||
                          messages[index - 1].senderId !== message.senderId
                        }
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Input de Mensagem */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <ChatInput onSendMessage={handleSendMessage} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
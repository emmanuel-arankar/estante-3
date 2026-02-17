import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Video, MoreVertical, Search, Image as ImageIcon, Mic, X, ChevronUp, ChevronDown, ArrowDown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatBubble } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatGallery } from '@/components/chat/ChatGallery';
import { PageMetadata } from '@/common/PageMetadata';
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { OnlineStatus } from '@/components/chat/OnlineStatus';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useAudioStore } from '@/hooks/useAudioStore';
import { markTemporaryAudioAsPlayed } from '@/services/realtime';
import { PATHS } from '@/router/paths';
import { ChatMessage } from '@estante/common-types';
import { userProfileQuery } from '@/features/users/userProfile.queries';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';

export const Chat = () => {
  const { receiverId } = useParams<{ receiverId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    messages,
    loading,
    isTyping,
    isRecording,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    sendMessage,
    deleteMessage,
    deleteChat,
    editMessage,
    reactToMessage,
    updateTyping,
    markMessageAsViewed
  } = useChat(receiverId || '');

  const { getAnonymizedUser } = useBlockedUsers();

  // Usar endpoint protegido que verifica bloqueio ANTES de retornar dados
  const { data: receiverInfo, error: receiverError } = useQuery({
    ...userProfileQuery(receiverId || ''),
    enabled: !!receiverId,
    // Não usar initialData do state, pois pode conter dados de usuário bloqueado
  });

  // Se erro (403 = bloqueado) ou EU bloqueei ele, mostrar genérico
  const anonymizedData = receiverId ? getAnonymizedUser(receiverId) : null;
  const wasBlockedByReceiver = receiverError !== null;

  // Detectar se chat está bloqueado (qualquer direção)
  const isBlocked = wasBlockedByReceiver || !!anonymizedData?.isBlocked;

  // Não usar dados não verificados - apenas API protegida
  const displayReceiverName = anonymizedData?.displayName
    || (wasBlockedByReceiver ? 'Usuário' : receiverInfo?.displayName)
    || 'Usuário';

  const displayReceiverPhoto = (anonymizedData?.isBlocked || wasBlockedByReceiver)
    ? undefined
    : receiverInfo?.photoURL;

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Memo para encontrar todos os IDs de mensagens que dão match com a busca
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return messages
      .filter(m => {
        if (m.type !== 'text') return false;
        const content = m.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return content.includes(query);
      })
      .map(m => m.id);
  }, [messages, searchQuery]);

  const { online: isOnline } = useUserPresence(receiverId || '');


  const scrollRef = useRef<HTMLDivElement>(null);
  const { setActiveId } = useAudioStore();

  // Helper to check if user is at the bottom
  const isAtBottom = () => {
    if (!scrollRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Buffer reduced to 50px to prevent accidental scrolling when interacting near bottom
    return scrollHeight - scrollTop - clientHeight < 50;
  };

  // Auto-scroll para o final
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', force: boolean = false) => {
    if (scrollRef.current && (force || isAtBottom())) {
      const scrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTo({
        top: scrollHeight,
        behavior
      });
    }
  };

  // Track previous messages
  const prevMessagesRef = useRef<ChatMessage[]>([]);

  // Effect to handle new messages (sent or received)
  useEffect(() => {
    const prevLen = prevMessagesRef.current.length;
    const curLen = messages.length;

    if (curLen > prevLen) {
      const lastMsg = messages[curLen - 1];
      const isOwn = lastMsg.senderId === user?.uid;

      // Force scroll if it's my own message or if I'm already at the bottom
      const forceScroll = isOwn || isAtBottom();

      const timer = setTimeout(() => {
        scrollToBottom(isOwn ? 'auto' : 'smooth', forceScroll);
      }, 100); // Slightly longer delay to ensure DOM is ready

      return () => clearTimeout(timer);
    }

    prevMessagesRef.current = messages;
  }, [messages]);

  // Use ResizeObserver to stay at bottom when content size changes (e.g. images loading)
  useEffect(() => {
    if (!scrollRef.current) return;

    const observer = new ResizeObserver(() => {
      // Only auto-scroll if we were already at the bottom
      if (isAtBottom()) {
        scrollToBottom('auto');
      }
    });

    observer.observe(scrollRef.current);
    // Also observe the inner container to catch message additions
    const innerContainer = scrollRef.current.firstElementChild;
    if (innerContainer) observer.observe(innerContainer);

    return () => observer.disconnect();
  }, []);


  // Track if initial scroll has happened
  const hasScrolledRef = useRef(false);

  // Force scroll to bottom when loading finishes for the first time
  useEffect(() => {
    if (!loading && messages.length > 0 && !hasScrolledRef.current) {
      scrollToBottom('auto', true);
      hasScrolledRef.current = true;
      // Double check after layout settles
      setTimeout(() => scrollToBottom('auto', true), 300);
    }
  }, [loading, messages.length]);

  // Scroll on typing/recording start
  useEffect(() => {
    if (isTyping || isRecording) {
      scrollToBottom('smooth');
    }
  }, [isTyping, isRecording]);

  // Monitor scroll position to show/hide "Scroll to Bottom" button
  useEffect(() => {
    const handleScroll = () => {
      if (!isAtBottom()) {
        setShowScrollBottom(true);
      } else {
        setShowScrollBottom(false);
      }
    };

    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleScroll);
      return () => scrollEl.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate(PATHS.LOGIN);
      return;
    }

    if (!receiverId) {
      navigate(PATHS.MESSAGES);
      return;
    }
  }, [user, receiverId, navigate]);

  const handleSendMessage = async (
    content: string,
    type: string = 'text',
    isTemporary?: boolean,
    file?: Blob,
    waveform?: number[],
    duration?: number,
    caption?: string,
    viewOnce?: boolean,
    images?: Blob[]
  ) => {
    await sendMessage(content, type as any, isTemporary, file, waveform, duration, caption, viewOnce, images);
  };

  // Handler para marcar áudio temporário como reproduzido (persiste no Firebase)
  const handleMarkTemporaryAsPlayed = async (messageId: string) => {
    if (!user || !receiverId) return;
    await markTemporaryAudioAsPlayed(user.uid, receiverId, messageId);
  };

  const handlePlayNext = (currentMessageId: string) => {
    const currentIndex = messages.findIndex(m => m.id === currentMessageId);
    if (currentIndex !== -1) {
      // Find next audio (sequential playback)
      for (let i = currentIndex + 1; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.type === 'audio' && !msg.isDeleted) {
          setActiveId(msg.id);
          break;
        }
      }
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      // Pequeno delay para garantir que eventuais menus/popovers fecharam
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        element.classList.add('bg-orange-50');
        setTimeout(() => element.classList.remove('bg-orange-50'), 2000);
      }, 50);

    }
  };


  // Helper para formatar a data do grupo
  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchMatches.length;
    setCurrentSearchIndex(nextIndex);
    scrollToMessage(searchMatches[nextIndex]);
  };

  const handleSearchPrev = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentSearchIndex(prevIndex);
    scrollToMessage(searchMatches[prevIndex]);
  };

  // Resetar index quando query mudar (começar do mais recente = último index)
  useEffect(() => {
    if (searchMatches.length > 0) {
      const lastIndex = searchMatches.length - 1;
      setCurrentSearchIndex(lastIndex);
      scrollToMessage(searchMatches[lastIndex]);
    } else {
      setCurrentSearchIndex(0);
    }
  }, [searchQuery, searchMatches.length]);

  // Agrupa mensagens por data (não mais filtrado por busca)
  const groupedMessages = useMemo(() => {
    const groups: { date: Date; messages: ChatMessage[] }[] = [];
    messages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt);
      const group = groups.find((g) => isSameDay(g.date, msgDate));
      if (group) {
        group.messages.push(msg);
      } else {
        groups.push({ date: msgDate, messages: [msg] });
      }
    });
    return groups;
  }, [messages]);





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
        title={`Chat com ${displayReceiverName}`}
        description={`Conversa com ${displayReceiverName}.`}
        noIndex={true}
      />

      <main className="h-[calc(100vh-80px)] w-full max-w-6xl mx-auto px-4 pt-8 pb-8 flex flex-col">
        <div className="bg-white shadow-sm flex-1 flex flex-col w-full overflow-hidden rounded-2xl border border-gray-200/60">


          {/* Header do Chat */}
          <div className="flex items-center justify-between px-4 border-b border-gray-200 bg-white z-10 shrink-0 h-[72px]">

            <AnimatePresence mode="wait">
              {isSearching ? (
                <motion.div
                  key="search-bar"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center flex-1 space-x-2"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsSearching(false);
                      setSearchQuery('');
                    }}
                    className="rounded-full shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Pesquisar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-100 border-none rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Reserved space for controls to prevent jump */}
                  {/* Reserved space for controls to prevent jump, widened for 'folga' */}
                  <div className="flex items-center justify-end space-x-2 shrink-0 min-w-[140px] h-9">
                    {searchQuery && searchMatches.length > 0 ? (
                      <>
                        <span className="text-[12px] font-medium text-gray-600 mr-2 whitespace-nowrap">
                          {searchMatches.length - currentSearchIndex} de {searchMatches.length}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSearchPrev} // Reverted: Up is Prev (Older/Above)
                            className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          >
                            <ChevronUp className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSearchNext} // Reverted: Down is Next (Newer/Below)
                            className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </Button>

                        </div>
                      </>
                    ) : searchQuery && searchMatches.length === 0 ? (
                      <span className="text-[12px] font-medium text-gray-400 whitespace-nowrap px-2">
                        Sem resultados
                      </span>
                    ) : null}
                  </div>


                </motion.div>
              ) : (

                <motion.div
                  key="chat-info"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center flex-1 justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      onClick={() => navigate(PATHS.MESSAGES)}
                      className="rounded-full mr-1"
                    >
                      <ArrowLeft className="h-5 w-5 text-gray-600" />

                    </Button>

                    <Link
                      to={receiverInfo?.nickname ? PATHS.PROFILE({ nickname: receiverInfo.nickname }) : '#'}
                      className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={displayReceiverPhoto} alt={displayReceiverName} />
                          <AvatarFallback>
                            {displayReceiverName.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineStatus userId={receiverId} className="absolute -bottom-1 -right-1" />
                      </div>

                      <div>
                        <h1 className="font-semibold text-gray-900 leading-tight">
                          {displayReceiverName}
                        </h1>
                        <p className={cn("text-[10px] font-medium", isOnline ? "text-emerald-600" : "text-gray-400")}>
                          {isOnline ? 'Online agora' : 'Offline'}
                        </p>
                      </div>
                    </Link>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="icon" className="rounded-full text-gray-500">
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-gray-500">
                      <Video className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-gray-500"
                      onClick={() => setIsSearching(true)}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full text-gray-500">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setIsGalleryOpen(true)}>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Mídia do Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas para você.')) {
                              deleteChat(user?.uid || '', receiverId || '');
                              navigate(PATHS.MESSAGES);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Conversa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* Área de Mensagens */}
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-auto p-4 space-y-1"
            >
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-gray-100 rounded-full p-6 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={displayReceiverPhoto} alt={displayReceiverName} />
                      <AvatarFallback className="text-2xl">
                        {displayReceiverName.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Comece uma conversa com {displayReceiverName}
                  </h3>
                  <p className="text-gray-500">
                    Envie uma mensagem para iniciar o chat
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedMessages.map((group) => (
                    <div key={group.date.toISOString()} className="space-y-1">
                      {/* Header de Data Sticky */}
                      <div className="sticky top-2 z-10 flex justify-center my-4 pointer-events-none">
                        <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-gray-500 shadow-sm border border-gray-100 uppercase tracking-tighter">
                          {formatDateLabel(group.date)}
                        </span>
                      </div>

                      {group.messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          id={`msg-${message.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            opacity: { duration: 0.2 }
                          }}
                          className="transition-colors duration-500 rounded-lg p-1"
                        >
                          <ChatBubble
                            message={message}
                            isOwn={message.senderId === user.uid}
                            onReply={() => {
                              setEditingMessage(null);
                              setReplyingTo(message);
                            }}
                            onDelete={() => deleteMessage(message.id)}
                            onMarkAsViewed={markMessageAsViewed}
                            onReact={(emoji: string) => reactToMessage(message.id, emoji)}
                            onMarkTemporaryAsPlayed={handleMarkTemporaryAsPlayed}
                            currentUserId={user.uid}
                            showAvatar={
                              index === 0 ||
                              group.messages[index - 1].senderId !== message.senderId
                            }
                            senderName={message.senderId === user.uid ? 'Você' : displayReceiverName}
                            senderPhoto={message.senderId === user.uid ? (user.photoURL || undefined) : (displayReceiverPhoto || undefined)}
                            onPlayNext={() => handlePlayNext(message.id)}
                            onEdit={() => {
                              setReplyingTo(null);
                              setEditingMessage(message);
                            }}
                            onJumpToMessage={scrollToMessage}
                            searchQuery={searchQuery}
                            isCurrentMatch={searchMatches[currentSearchIndex] === message.id}
                          />

                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Indicadores de Status (Digitando/Gravando) */}
              {(isTyping || isRecording) && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center space-x-2 text-emerald-600 text-sm ml-12 pb-2 font-medium"
                >
                  {isRecording ? (
                    <div className="flex items-center space-x-2">
                      <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex items-center justify-center"
                      >
                        <Mic className="h-4 w-4 fill-current" />
                      </motion.div>
                      <span>{displayReceiverName} está gravando áudio...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1.5 items-center">
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                          className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                          className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                          className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                        />
                      </div>
                      <span>{displayReceiverName} está digitando...</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Scroll to Bottom Button */}
            <AnimatePresence>
              {showScrollBottom && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-4 right-4 z-20"
                >
                  <Button
                    onClick={() => scrollToBottom('smooth', true)}
                    className="h-10 w-10 rounded-full bg-white shadow-lg border border-gray-100 text-emerald-600 hover:bg-emerald-50 p-0"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input de Mensagem */}
          <div className="border-t border-gray-200 p-4 bg-white shrink-0">
            <ChatInput
              onSendMessage={handleSendMessage as any}
              onTyping={updateTyping}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              editingMessage={editingMessage}
              onCancelEdit={() => setEditingMessage(null)}
              onEditMessage={editMessage}
              recipientName={displayReceiverName}
              disabled={isBlocked}
            />
          </div>
        </div>
      </main>

      <ChatGallery
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        messages={messages}
      />
    </>
  );
};
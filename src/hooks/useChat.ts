import { useState, useEffect, useCallback } from 'react';
import { toastErrorClickable } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import {
  sendMessage,
  subscribeToMessages,
  getUserChats,
  updateUserChatList,
  setTypingStatus,
  subscribeToTypingStatus,
  markAllMessagesAsRead,
  deleteMessage,
  deleteChat,
  editMessage,
  toggleReaction,
  generateMessageId,
  markMessageAsViewed,
} from '@/services/realtime';
import { uploadImage as uploadAudio } from '@/services/storage';
import { ChatMessage, User } from '@estante/common-types';
import { userQuery } from '@/features/users/user.queries';
import { queryClient } from '@/lib/queryClient';

export const useChat = (receiverId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingStatus, setTypingStatusState] = useState<boolean | 'recording'>(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [receiverInfo, setReceiverInfo] = useState<User | null>(null);


  useEffect(() => {
    if (receiverId) {
      queryClient.fetchQuery(userQuery(receiverId))
        .then(setReceiverInfo)
        .catch(console.error);
    }
  }, [receiverId]);

  // Enviar mensagem
  const handleSendMessage = useCallback(async (
    content: string,
    type: ChatMessage['type'] = 'text',
    isTemporary?: boolean,
    file?: Blob, // Arquivo para upload em background (áudio)
    waveform?: number[], // Waveform para persistência
    duration?: number, // Duração para áudio
    caption?: string, // Legenda para imagem
    viewOnce?: boolean, // Visualização única
    images?: Blob[] // Imagens para upload em background (Grid)
  ) => {
    if (!user || !receiverId) {
      toastErrorClickable('Erro ao enviar mensagem');
      return;
    }

    const replyData = replyingTo ? {
      id: replyingTo.id,
      content: replyingTo.content,
      type: replyingTo.type,
      senderId: replyingTo.senderId,
      senderName: replyingTo.senderId === user.uid ? 'Você' : (receiverInfo?.displayName || 'Usuário')
    } : undefined;

    // UI Otimista para Áudio (Zero-Flicker Architecture)
    if (type === 'audio' && file) {
      const messageId = generateMessageId(user.uid, receiverId);

      const optimisticMsg: ChatMessage = {
        id: messageId,
        senderId: user.uid,
        receiverId,
        content, // URL local (blob:)
        type,
        createdAt: new Date(),
        status: 'sending',
        isTemporary,
        replyTo: replyData,
        waveform,
        duration
      };

      setMessages(prev => [...prev, optimisticMsg]);

      (async () => {
        try {
          const fileName = `audio_${Date.now()}.webm`;
          const uploadFile = new File([file], fileName, { type: 'audio/webm' });
          const remoteUrl = await uploadAudio(uploadFile, `chats/${user.uid}/audio`);

          await sendMessage(user.uid, receiverId, remoteUrl, type, replyData, isTemporary, messageId, waveform, duration, undefined, viewOnce);
          await updateUserChatList(
            user.uid,
            receiverId,
            "Áudio",
            new Date(),
            type,
            { displayName: receiverInfo?.displayName, photoURL: receiverInfo?.photoURL },
            { displayName: user.displayName || undefined, photoURL: user.photoURL || undefined }
          );

          setTypingStatus(user.uid, receiverId, false).catch(() => { });
        } catch (err) {
          console.error('Background upload failed:', err);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'error' } : m));
          toastErrorClickable('Falha no envio do áudio');
        }
      })();

      setReplyingTo(null);
      return;
    }

    // UI Otimista para Imagens (Grid / Batch)
    if (type === 'image' && images && images.length > 0) {
      const messageId = generateMessageId(user.uid, receiverId);

      // Criar URLs locais para o preview imediato
      const localPreviewUrls = images.map(img => URL.createObjectURL(img));

      const optimisticMsg: ChatMessage = {
        id: messageId,
        senderId: user.uid,
        receiverId,
        content: localPreviewUrls[0], // Fallback/Thumbnail principal
        images: localPreviewUrls,
        type,
        createdAt: new Date(),
        status: 'sending',
        isTemporary,
        replyTo: replyData,
        caption,
        viewOnce
      };

      setMessages(prev => [...prev, optimisticMsg]);

      // Background Upload
      (async () => {
        try {
          // Import dinâmico para evitar dependência circular se houver, ou apenas garantir uso correto
          const { uploadImage } = await import('@/services/storage');

          const uploadPromises = images.map((img, idx) => uploadImage(img, `chats/${user.uid}/images/img_${Date.now()}_${idx}`));
          const remoteUrls = await Promise.all(uploadPromises);

          await sendMessage(
            user.uid,
            receiverId,
            remoteUrls[0], // Main content URL
            type,
            replyData,
            isTemporary,
            messageId,
            undefined,
            undefined,
            caption,
            viewOnce,
            remoteUrls // Full Grid
          );

          await updateUserChatList(
            user.uid,
            receiverId,
            remoteUrls.length > 1 ? `📷 ${remoteUrls.length} Fotos` : "📷 Foto",
            new Date(),
            type,
            { displayName: receiverInfo?.displayName, photoURL: receiverInfo?.photoURL },
            { displayName: user.displayName || undefined, photoURL: user.photoURL || undefined }
          );

          setTypingStatus(user.uid, receiverId, false).catch(() => { });
        } catch (err) {
          console.error('Background image upload failed:', err);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'error' } : m));
          toastErrorClickable('Falha no envio das imagens');
        }
      })();

      setReplyingTo(null);
      return;
    }

    // Fluxo Padrão (Texto ou Imagem com legenda)
    const messageId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: messageId,
      senderId: user.uid,
      receiverId,
      content,
      type,
      createdAt: new Date(),
      status: 'sending',
      isTemporary,
      replyTo: replyData,
      caption,
      viewOnce
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      await sendMessage(user.uid, receiverId, content, type, replyData, isTemporary, messageId, undefined, duration, caption, viewOnce);
      await updateUserChatList(
        user.uid,
        receiverId,
        type === 'image' ? "📷 Foto" : content,
        new Date(),
        type,
        { displayName: receiverInfo?.displayName, photoURL: receiverInfo?.photoURL },
        { displayName: user.displayName || undefined, photoURL: user.photoURL || undefined }
      );
      await setTypingStatus(user.uid, receiverId, false);
      setReplyingTo(null);
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'error' } : m));
      toastErrorClickable('Erro ao enviar mensagem');
      console.error('Error sending message:', error);
    }
  }, [user, receiverId, replyingTo, receiverInfo]);

  // Editar mensagem
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!user || !receiverId) return;
    try {
      await editMessage(user.uid, receiverId, messageId, newContent);
      // Atualiza a lista de chats para refletir a edição na prévia
      await updateUserChatList(
        user.uid,
        receiverId,
        newContent,
        new Date(),
        'text',
        { displayName: receiverInfo?.displayName, photoURL: receiverInfo?.photoURL },
        { displayName: user.displayName || undefined, photoURL: user.photoURL || undefined }
      );
      setEditingMessage(null);
    } catch (error) {
      toastErrorClickable('Erro ao editar mensagem');
      console.error('Error editing message:', error);
    }
  }, [user, receiverId, receiverInfo]);


  // Apagar mensagem
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!user || !receiverId) return;
    try {
      await deleteMessage(user.uid, receiverId, messageId);
    } catch (error) {
      toastErrorClickable('Erro ao apagar mensagem');
      console.error('Error deleting message:', error);
    }
  }, [user, receiverId]);

  // Reagir a uma mensagem
  const handleReactToMessage = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !receiverId) return;
    try {
      await toggleReaction(user.uid, receiverId, messageId, emoji, user.uid);
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  }, [user, receiverId]);

  // Atualizar meu status de digitação ou gravação
  const updateTyping = useCallback((status: boolean | 'recording') => {
    if (!user || !receiverId) return;
    setTypingStatus(user.uid, receiverId, status).catch(() => { });
  }, [user, receiverId]);

  // Ouve mensagens do chat atual
  useEffect(() => {
    if (!user || !receiverId) return;

    setLoading(true);
    const unsubscribe = subscribeToMessages(user.uid, receiverId, (newMessages) => {
      // Reconciliação Inteligente: Une mensagens locais (sending) com remotas
      setMessages(prev => {
        const messageMap = new Map<string, ChatMessage>();

        // 1. Preserva mensagens locais que ainda estão sendo enviadas
        // Isso inclui tanto as com ID estável (generated) quanto as legadas (temp_)
        prev.forEach(msg => {
          if (msg.status === 'sending') {
            messageMap.set(msg.id, msg);
          }
        });

        // 2. Adiciona/Sobrescreve com mensagens do Firebase
        // Se o upload terminou e o Firebase notificou, a mensagem com ID estável será atualizada aqui
        newMessages.forEach(msg => {
          messageMap.set(msg.id, msg);
        });

        return Array.from(messageMap.values()).sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      setLoading(false);

      const isWindowActive = document.hasFocus() && document.visibilityState === 'visible';

      if (isWindowActive) {
        const hasUnread = newMessages.some(m => m.receiverId === user.uid && !m.readAt);
        if (hasUnread) {
          markAllMessagesAsRead(user.uid, receiverId).catch(() => { });
        }
      }
    });

    const handleFocus = () => {
      setTimeout(() => {
        if (receiverId) {
          markAllMessagesAsRead(user.uid, receiverId).catch(() => { });
        }
      }, 100);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, receiverId]);

  // Ouve se o parceiro está digitando ou gravando para mim
  useEffect(() => {
    if (!user || !receiverId) return;

    const unsubscribe = subscribeToTypingStatus(user.uid, receiverId, (status) => {
      setTypingStatusState(status);
    });

    return unsubscribe;
  }, [user, receiverId]);

  // Ouve a lista de chats do usuário
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getUserChats(user.uid, (userChats) => {
      setChats(userChats);
    });

    return unsubscribe;
  }, [user]);

  const deleteChatHandler = useCallback(async (myId: string, otherId: string) => {
    try {
      await deleteChat(myId, otherId);
    } catch (error) {
      console.error("Erro ao deletar chat:", error);
      toastErrorClickable('Erro ao deletar conversa');
    }
  }, []);

  const markMessageAsViewedHandler = useCallback(async (messageId: string) => {
    if (!user || !receiverId) return;
    try {
      await markMessageAsViewed(user.uid, receiverId, messageId);
      // Local update for immediate feedback
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isViewed: true } : m));
    } catch (error) {
      console.error("Erro ao marcar como visualizado:", error);
    }
  }, [user, receiverId]);

  return {
    messages,
    chats,
    loading,
    receiverInfo,
    isTyping: typingStatus === true,
    isRecording: typingStatus === 'recording',
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    sendMessage: handleSendMessage,
    deleteMessage: handleDeleteMessage,
    markMessageAsRead: markAllMessagesAsRead,
    editMessage: handleEditMessage,
    reactToMessage: handleReactToMessage,
    updateTyping,
    deleteChat: deleteChatHandler,
    markMessageAsViewed: markMessageAsViewedHandler
  };
};

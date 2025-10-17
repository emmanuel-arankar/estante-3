import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  sendMessage,
  subscribeToMessages,
  getUserChats,
  setUserOnline,
  setUserOffline,
  updateUserChatList,
} from '../services/realtime';
import { ChatMessage } from '../models';
import { toastErrorClickable } from '@/components/ui/toast';

export const useChat = (receiverId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Send message
  const handleSendMessage = useCallback(async (
    content: string,
    type: ChatMessage['type'] = 'text'
  ) => {
    if (!user || !receiverId) {
      toastErrorClickable('Erro ao enviar mensagem');
      return;
    }

    try {
      await sendMessage(user.uid, receiverId, content, type);
      
      // Update chat lists
      await updateUserChatList(user.uid, receiverId, content, new Date());
    } catch (error) {
      toastErrorClickable('Erro ao enviar mensagem');
      console.error('Error sending message:', error);
    }
  }, [user, receiverId]);

  // Subscribe to messages for current chat
  useEffect(() => {
    if (!user || !receiverId) return;

    setLoading(true);
    const unsubscribe = subscribeToMessages(user.uid, receiverId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, receiverId]);

  // Subscribe to user's chats
  useEffect(() => {
    if (!user) return;

    const unsubscribe = getUserChats(user.uid, (userChats) => {
      setChats(userChats);
    });

    return unsubscribe;
  }, [user]);

  // Set user online status
  useEffect(() => {
    if (!user) return;

    setUserOnline(user.uid);

    const handleBeforeUnload = () => {
      setUserOffline(user.uid);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      setUserOffline(user.uid);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  return {
    messages,
    chats,
    loading,
    sendMessage: handleSendMessage,
  };
};
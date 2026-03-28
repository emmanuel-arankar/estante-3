import { ref, onValue, off, query, limitToLast, orderByKey, endBefore, get } from 'firebase/database';
import { database } from '@/services/firebase/firebase';
import { ChatMessage } from '@estante/common-types';
import { apiClient } from '@/services/api/apiClient';

// Helper to generate ID client-side
export const generateMessageId = (_senderId: string, _receiverId: string): string => {
  return crypto.randomUUID();
};

// Chat Messages
export const sendMessage = async (
  _senderId: string,
  receiverId: string,
  content: string,
  type: ChatMessage['type'] = 'text',
  replyTo?: ChatMessage['replyTo'],
  isTemporary?: boolean,
  customId?: string,
  waveform?: number[],
  duration?: number,
  caption?: string,
  viewOnce?: boolean,
  images?: string[]
): Promise<void> => {
  await apiClient('/chat/messages', {
    method: 'POST',
    data: {
      receiverId,
      content,
      type,
      replyTo,
      isTemporary,
      customId,
      waveform,
      duration,
      caption,
      viewOnce,
      images,
    },
  });
};

export const subscribeToMessages = (
  senderId: string,
  receiverId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const chatId = getChatId(senderId, receiverId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  const messagesQuery = query(messagesRef, limitToLast(50));

  const unsubscribe = onValue(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];

    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      const message = {
        id: childSnapshot.key!,
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        readAt: data.readAt ? new Date(data.readAt) : null,
      } as ChatMessage;
      messages.push(message);
    });

    callback(messages);
  }, (error) => {
    console.error('[FIREBASE RTDB ERROR] subscribeToMessages falhou:', error);
  });

  return unsubscribe;
};

/**
 * @description Carrega mensagens mais antigas do que a mensagem mais antiga atualmente exibida.
 * Usado para implementar scroll infinito reverso (carregar histórico ao rolar para cima).
 */
export const loadOlderMessages = async (
  senderId: string,
  receiverId: string,
  oldestMessageId: string,
  pageSize: number = 30
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
  const chatId = getChatId(senderId, receiverId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  const olderQuery = query(
    messagesRef,
    orderByKey(),
    endBefore(oldestMessageId),
    limitToLast(pageSize + 1) // +1 para saber se há mais
  );

  const snapshot = await get(olderQuery);
  const messages: ChatMessage[] = [];

  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val();
    messages.push({
      id: childSnapshot.key!,
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      readAt: data.readAt ? new Date(data.readAt) : null,
    } as ChatMessage);
  });

  const hasMore = messages.length > pageSize;
  if (hasMore) {
    messages.shift(); // Remove o extra usado para detectar hasMore
  }

  return { messages, hasMore };
};

/**
 * Marca uma única mensagem como lida.
 */
export const markMessageAsRead = async (
  receiverId: string,
  messageId: string
): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    data: {
      otherId: receiverId,
      readAt: true
    },
  });
};

/**
 * Marca um áudio temporário como reproduzido.
 * Isso persiste no banco e invalida o áudio mesmo após reload.
 */
export const markTemporaryAudioAsPlayed = async (
  _senderId: string,
  receiverId: string,
  messageId: string
): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    data: {
      otherId: receiverId,
      playedAt: true
    },
  });
};

/**
 * Apaga uma mensagem (Soft delete no DB para privacidade).
 */
export const deleteMessage = async (
  senderId: string,
  receiverId: string,
  messageId: string
): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}`, {
    method: 'DELETE',
    data: { otherId: receiverId },
  });
};

/**
 * Exclui uma conversa inteira para o usuário e remove as mensagens do banco.
 */
export const markMessageAsViewed = async (_senderId: string, receiverId: string, messageId: string): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    data: {
      otherId: receiverId,
      viewedAt: true
    },
  });
};

export const deleteChat = async (_myId: string, otherId: string): Promise<void> => {
  await apiClient(`/chat/${otherId}`, {
    method: 'DELETE',
  });
};

/**
 * Edita o conteúdo de uma mensagem existente.
 * Só marca como editado se o conteúdo realmente mudou.
 */
export const editMessage = async (
  _senderId: string,
  receiverId: string,
  messageId: string,
  newContent: string
): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    data: {
      otherId: receiverId,
      content: newContent
    },
  });
};


/**
 * Alterna uma reação (emoji) em uma mensagem de forma exclusiva (uma por usuário).
 */
export const toggleReaction = async (
  _senderId: string,
  receiverId: string,
  messageId: string,
  emoji: string,
  _userId: string
): Promise<void> => {
  await apiClient(`/chat/messages/${messageId}/react`, {
    method: 'POST',
    data: {
      otherId: receiverId,
      emoji
    },
  });
};

/**
 * Marca todas as mensagens NÃO lidas de um chat como lidas.
 * Ideal para quando o usuário abre a tela de conversa.
 */
export const markAllMessagesAsRead = async (
  _myId: string,
  otherId: string
): Promise<void> => {
  await apiClient('/chat/read-all', {
    method: 'POST',
    data: { otherId },
  });
};



export const getUserChats = (
  userId: string,
  callback: (chats: any[]) => void
): (() => void) => {
  const userChatsRef = ref(database, `userChats/${userId}`);

  const unsubscribe = onValue(userChatsRef, (snapshot) => {
    const chats: any[] = [];

    snapshot.forEach((childSnapshot) => {
      const chat = {
        id: childSnapshot.key!,
        otherUserId: childSnapshot.key!,
        ...childSnapshot.val(),
      };
      chats.push(chat);
    });

    callback(chats);
  });

  return unsubscribe;
};

/**
 * Escuta o contador total de mensagens não lidas de todos os chats do usuário.
 */
export const subscribeToTotalUnreadMessages = (
  userId: string,
  callback: (total: number) => void
): (() => void) => {
  const userChatsRef = ref(database, `userChats/${userId}`);

  const unsubscribe = onValue(userChatsRef, (snapshot) => {
    const chats = snapshot.val();
    let total = 0;
    if (chats) {
      Object.values(chats).forEach((chat: any) => {
        total += (chat.unreadCount || 0);
      });
    }
    callback(total);
  });

  return unsubscribe;
};

// Helper function to create consistent chat IDs
const getChatId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

// Online presence
export const setUserOnline = async (_userId: string): Promise<void> => {
  await apiClient('/chat/presence', {
    method: 'POST',
    data: { online: true },
  });
};

export const setUserOffline = async (_userId: string): Promise<void> => {
  await apiClient('/chat/presence', {
    method: 'POST',
    data: { online: false },
  });
};

export const subscribeToUserStatus = (
  userId: string,
  callback: (isOnline: boolean, lastSeen?: Date) => void
): (() => void) => {
  const userStatusRef = ref(database, `status/${userId}`);

  const unsubscribe = onValue(userStatusRef, (snapshot) => {
    const status = snapshot.val();
    if (status) {
      callback(status.online, status.lastSeen ? new Date(status.lastSeen) : undefined);
    } else {
      callback(false);
    }
  });

  return unsubscribe;
};

// --- Typing Indicator ---

/**
 * Define se o usuário atual está digitando ou gravando áudio para outro usuário.
 */
export const setTypingStatus = async (
  _senderId: string,
  receiverId: string,
  status: boolean | 'recording'
): Promise<void> => {
  await apiClient('/chat/typing', {
    method: 'POST',
    data: {
      receiverId,
      status
    },
  });
};

/**
 * Escuta se alguém está digitando ou gravando para o usuário atual.
 */
export const subscribeToTypingStatus = (
  myId: string,
  senderId: string,
  callback: (status: boolean | 'recording') => void
): (() => void) => {
  const typingRef = ref(database, `typing/${myId}/${senderId}`);

  const unsubscribe = onValue(typingRef, (snapshot) => {
    callback(snapshot.val());
  });

  return () => off(typingRef, 'value', unsubscribe);
};

// --- Connection Monitor ---

/**
 * Escuta o estado de conexão com o RTDB.
 */
export const subscribeToConnection = (callback: (isConnected: boolean) => void): (() => void) => {
  const connectedRef = ref(database, '.info/connected');
  return onValue(connectedRef, (snapshot) => {
    callback(snapshot.val() === true);
  });
};

export type Unsubscribe = () => void;
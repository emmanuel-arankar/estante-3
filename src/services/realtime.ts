import {
  ref,
  push,
  onValue,
  off,
  query,
  limitToLast,
  serverTimestamp,
  set,
  update,
  get,
  onDisconnect,
  increment,
  runTransaction,
  remove
} from 'firebase/database';
import { database } from '@/services/firebase';
import { ChatMessage } from '@estante/common-types';

// Helper to generate ID client-side
export const generateMessageId = (senderId: string, receiverId: string): string => {
  const chatId = getChatId(senderId, receiverId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  return push(messagesRef).key!;
};

// Chat Messages
export const sendMessage = async (
  senderId: string,
  receiverId: string,
  content: string,
  type: ChatMessage['type'] = 'text',
  replyTo?: ChatMessage['replyTo'],
  isTemporary?: boolean,
  customId?: string, // Optional: Allow client to pre-generate ID
  waveform?: number[], // Optional: Audio waveform data
  duration?: number, // Optional: Audio duration in seconds
  caption?: string, // Optional: Image caption
  viewOnce?: boolean, // Optional: WhatsApp-style view once
  images?: string[] // Optional: Array of image URLs for Grid
): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);

  const messageData = {
    senderId,
    receiverId,
    content,
    type,
    createdAt: serverTimestamp(),
    readAt: null,
    ...(replyTo && { replyTo }),
    ...(isTemporary && { isTemporary }),
    ...(waveform && { waveform }),
    ...(duration && { duration }),
    ...(caption && { caption }),
    ...(viewOnce && { viewOnce }),
    ...(images && { images }),
  };

  if (customId) {
    // If ID is provided (Optimistic UI), use SET to ensure idempotency and no flicker
    await set(ref(database, `chats/${chatId}/messages/${customId}`), messageData);
  } else {
    await push(messagesRef, messageData);
  }
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
  });

  return unsubscribe;
};

/**
 * Marca uma única mensagem como lida.
 */
export const markMessageAsRead = async (
  chatId: string,
  messageId: string
): Promise<void> => {
  const messageRef = ref(database, `chats/${chatId}/messages/${messageId}`);
  await update(messageRef, {
    readAt: serverTimestamp(),
  });
};

/**
 * Marca um áudio temporário como reproduzido.
 * Isso persiste no banco e invalida o áudio mesmo após reload.
 */
export const markTemporaryAudioAsPlayed = async (
  senderId: string,
  receiverId: string,
  messageId: string
): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  const messageRef = ref(database, `chats/${chatId}/messages/${messageId}`);
  await update(messageRef, {
    playedAt: serverTimestamp(),
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
  const chatId = getChatId(senderId, receiverId);
  const messageRef = ref(database, `chats/${chatId}/messages/${messageId}`);

  await update(messageRef, {
    content: "Mensagem apagada",
    isDeleted: true,
  });
};

/**
 * Exclui uma conversa inteira para o usuário e remove as mensagens do banco.
 */
export const markMessageAsViewed = async (senderId: string, receiverId: string, messageId: string): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  await update(ref(database, `chats/${chatId}/messages/${messageId}`), {
    isViewed: true,
    viewedAt: serverTimestamp()
  });
};

export const deleteChat = async (myId: string, otherId: string): Promise<void> => {
  const chatId = getChatId(myId, otherId);
  const messagesRef = ref(database, `chats/${chatId}`);
  const myChatRef = ref(database, `userChats/${myId}/${otherId}`);

  await Promise.all([
    remove(messagesRef),
    remove(myChatRef)
  ]);
};

/**
 * Edita o conteúdo de uma mensagem existente.
 * Só marca como editado se o conteúdo realmente mudou.
 */
export const editMessage = async (
  senderId: string,
  receiverId: string,
  messageId: string,
  newContent: string
): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  const messageRef = ref(database, `chats/${chatId}/messages/${messageId}`);

  // Verificar se o conteúdo realmente mudou
  const snapshot = await get(messageRef);
  if (snapshot.exists()) {
    const currentMessage = snapshot.val();
    if (currentMessage.content === newContent) {
      // Conteúdo não mudou, não marcar como editado
      return;
    }
  }

  await update(messageRef, {
    content: newContent,
    editedAt: serverTimestamp(),
  });
};


/**
 * Alterna uma reação (emoji) em uma mensagem de forma exclusiva (uma por usuário).
 */
export const toggleReaction = async (
  senderId: string,
  receiverId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  const reactionsRef = ref(database, `chats/${chatId}/messages/${messageId}/reactions`);

  await runTransaction(reactionsRef, (currentReactions: Record<string, string[]> | null) => {
    const reactions = currentReactions || {};
    let alreadyHadThisEmoji = false;

    // 1. Remover o usuário de QUALQUER emoji que ele já tenha reagido nesta mensagem
    Object.keys(reactions).forEach(e => {
      const users = reactions[e] || [];
      const index = users.indexOf(userId);
      if (index > -1) {
        if (e === emoji) alreadyHadThisEmoji = true;
        users.splice(index, 1);
        // Se a lista de usuários para esse emoji ficar vazia, removemos a chave
        if (users.length === 0) {
          delete reactions[e];
        }
      }
    });

    // 2. Se o usuário NÃO tinha ESSE emoji específico, adicionamos ele
    if (!alreadyHadThisEmoji) {
      if (!reactions[emoji]) {
        reactions[emoji] = [userId];
      } else {
        reactions[emoji].push(userId);
      }
    }

    return Object.keys(reactions).length === 0 ? null : reactions;
  });
};

/**
 * Marca todas as mensagens NÃO lidas de um chat como lidas.
 * Ideal para quando o usuário abre a tela de conversa.
 */
export const markAllMessagesAsRead = async (
  myId: string,
  otherId: string
): Promise<void> => {
  const chatId = getChatId(myId, otherId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);

  // Pegamos as últimas mensagens para verificar o que precisa ser lido
  const snapshot = await get(query(messagesRef, limitToLast(50)));

  if (!snapshot.exists()) return;

  const updates: { [key: string]: any } = {};
  snapshot.forEach((child) => {
    const msg = child.val();
    // Se a mensagem foi para MIM e ainda não foi lida
    if (msg.receiverId === myId && !msg.readAt) {
      updates[`${child.key}/readAt`] = serverTimestamp();
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(messagesRef, updates);
  }

  // SEMPRE zera o contador de não lidas na lista de chats ao entrar
  const myChatRef = ref(database, `userChats/${myId}/${otherId}`);
  await update(myChatRef, { unreadCount: 0 });

  // Também marca como lido para o OUTRO ver na lista dele (Visto duplo no /messages)
  const otherChatRef = ref(database, `userChats/${otherId}/${myId}`);
  const otherChatSnap = await get(otherChatRef);
  if (otherChatSnap.exists() && !otherChatSnap.val().lastMessageRead) {
    await update(otherChatRef, { lastMessageRead: true });
  }
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
export const setUserOnline = async (userId: string): Promise<void> => {
  const userStatusRef = ref(database, `status/${userId}`);
  await set(userStatusRef, {
    online: true,
    lastSeen: serverTimestamp(),
  });

  // Set offline when user disconnects
  onDisconnect(userStatusRef).set({
    online: false,
    lastSeen: serverTimestamp(),
  });
};

export const setUserOffline = async (userId: string): Promise<void> => {
  const userStatusRef = ref(database, `status/${userId}`);
  await set(userStatusRef, {
    online: false,
    lastSeen: serverTimestamp(),
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

// Update user chat list when new message is sent
export const updateUserChatList = async (
  senderId: string,
  receiverId: string,
  lastMessage: string,
  messageTime: Date,
  type: ChatMessage['type'] = 'text',
  receiverMetadata?: { displayName?: string; photoURL?: string },
  senderMetadata?: { displayName?: string; photoURL?: string }
): Promise<void> => {
  const senderChatRef = ref(database, `userChats/${senderId}/${receiverId}`);
  const receiverChatRef = ref(database, `userChats/${receiverId}/${senderId}`);

  // Prévias amigáveis de mídia
  let previewText = lastMessage;
  if (type === 'image') previewText = '📷 Foto';
  if (type === 'audio') previewText = '🎤 Áudio';
  if (type === 'book') previewText = '📖 Livro compartilhado';

  const baseData = {
    lastMessage: previewText,
    lastMessageTime: messageTime.getTime(),
    updatedAt: serverTimestamp(),
    lastSenderId: senderId,
    lastMessageRead: false,
  };

  const senderUpdate: any = { ...baseData, unreadCount: 0 };
  if (receiverMetadata?.displayName) senderUpdate.displayName = receiverMetadata.displayName;
  if (receiverMetadata?.photoURL) senderUpdate.photoURL = receiverMetadata.photoURL;

  const receiverUpdate: any = { ...baseData, unreadCount: increment(1) };
  if (senderMetadata?.displayName) receiverUpdate.displayName = senderMetadata.displayName;
  if (senderMetadata?.photoURL) receiverUpdate.photoURL = senderMetadata.photoURL;

  await Promise.all([
    update(senderChatRef, senderUpdate),
    update(receiverChatRef, receiverUpdate),
  ]);
};


// --- Typing Indicator ---

/**
 * Define se o usuário atual está digitando ou gravando áudio para outro usuário.
 */
export const setTypingStatus = async (
  senderId: string,
  receiverId: string,
  status: boolean | 'recording'
): Promise<void> => {
  const typingRef = ref(database, `typing/${receiverId}/${senderId}`);

  if (status) {
    await set(typingRef, status);
    onDisconnect(typingRef).remove();
  } else {
    await set(typingRef, null);
  }
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
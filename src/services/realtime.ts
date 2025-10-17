import {
  ref,
  push,
  onValue,
  off,
  query,
  limitToLast,
  serverTimestamp,
  set,
  onDisconnect,
} from 'firebase/database';
import { database } from './firebase';
import { ChatMessage } from '../models';

// Chat Messages
export const sendMessage = async (
  senderId: string,
  receiverId: string,
  content: string,
  type: ChatMessage['type'] = 'text'
): Promise<void> => {
  const chatId = getChatId(senderId, receiverId);
  const messagesRef = ref(database, `chats/${chatId}/messages`);
  
  await push(messagesRef, {
    senderId,
    receiverId,
    content,
    type,
    createdAt: serverTimestamp(),
    readAt: null,
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
      const message = {
        id: childSnapshot.key!,
        ...childSnapshot.val(),
        createdAt: childSnapshot.val().createdAt ? new Date(childSnapshot.val().createdAt) : new Date(),
      } as ChatMessage;
      messages.push(message);
    });
    
    callback(messages);
  });

  return () => off(messagesRef, 'value', unsubscribe);
};

export const markMessageAsRead = async (
  chatId: string,
  messageId: string
): Promise<void> => {
  const messageRef = ref(database, `chats/${chatId}/messages/${messageId}`);
  await push(messageRef, {
    readAt: serverTimestamp(),
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

  return () => off(userChatsRef, 'value', unsubscribe);
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

  return () => off(userStatusRef, 'value', unsubscribe);
};

// Update user chat list when new message is sent
export const updateUserChatList = async (
  senderId: string,
  receiverId: string,
  lastMessage: string,
  messageTime: Date
): Promise<void> => {
  const senderChatRef = ref(database, `userChats/${senderId}/${receiverId}`);
  const receiverChatRef = ref(database, `userChats/${receiverId}/${senderId}`);
  
  const chatData = {
    lastMessage,
    lastMessageTime: messageTime.getTime(),
    updatedAt: serverTimestamp(),
  };
  
  await Promise.all([
    set(senderChatRef, { ...chatData, unreadCount: 0 }),
    set(receiverChatRef, { ...chatData, unreadCount: 1 }), // Increment for receiver
  ]);
};
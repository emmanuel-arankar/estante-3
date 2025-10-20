import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  setDoc,
  getCountFromServer,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  Post,
  User,
  Book,
  UserBook,
  Comment,
  Notification,
  Friendship,
  FriendshipWithUser
} from '@estante/common-types';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  BOOKS: 'books',
  USER_BOOKS: 'userBooks',
  NOTIFICATIONS: 'notifications',
  COMMENTS: 'comments',
  FRIENDSHIPS: 'friendships',
  USER_AVATARS: 'userAvatars',
} as const;

// ==================== HELPER FUNCTIONS ====================
export const getUsersBatch = async (userIds: string[]): Promise<User[]> => {
  if (userIds.length === 0) return [];

  const allUsers: User[] = [];
  
  for (let i = 0; i < userIds.length; i += 10) {
    const batchIds = userIds.slice(i, i + 10);
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('__name__', 'in', batchIds)
    );
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      allUsers.push({ id: doc.id, ...doc.data() } as User);
    });
  }

  return allUsers;
};

// ==================== USER OPERATIONS ====================
export const createUser = async (userId: string, userData: Omit<User, 'id'>) => {
  await setDoc(doc(db, COLLECTIONS.USERS, userId), {
    ...userData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
    booksRead: 0,
    currentlyReading: 0,
    followers: 0,
    following: 0,
  });
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, COLLECTIONS.USERS, userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as User;
  }
  return null;
};

export const updateUser = async (userId: string, updates: Partial<User>) => {
  const docRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// ==================== FRIENDSHIP OPERATIONS ====================
export const sendFriendRequest = async (fromUserId: string, toUserId: string) => {
  const batch = writeBatch(db);
  
  // Create friendship documents (bidirectional)
  const friendshipId1 = `${fromUserId}_${toUserId}`;
  const friendshipRef1 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId1);
  batch.set(friendshipRef1, {
    userId: fromUserId,
    friendId: toUserId,
    status: 'pending',
    requestedBy: fromUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const friendshipId2 = `${toUserId}_${fromUserId}`;
  const friendshipRef2 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId2);
  batch.set(friendshipRef2, {
    userId: toUserId,
    friendId: fromUserId,
    status: 'pending',
    requestedBy: fromUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  
  // Create notification
  await createNotification({
    userId: toUserId,
    type: 'friend_request',
    fromUserId,
    message: 'enviou uma solicitação de amizade',
    read: false,
      createdAt: new Date(),
  });
};

export const acceptFriendRequest = async (userId: string, friendId: string) => {
  const batch = writeBatch(db);
  const friendshipDate = serverTimestamp();

  // Update both friendship documents
  const friendshipId1 = `${userId}_${friendId}`;
  const friendshipRef1 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId1);
  batch.update(friendshipRef1, {
    status: 'accepted',
    friendshipDate,
    updatedAt: serverTimestamp()
  });

  const friendshipId2 = `${friendId}_${userId}`;
  const friendshipRef2 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId2);
  batch.update(friendshipRef2, {
    status: 'accepted',
    friendshipDate,
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  
  // Create notification
  await createNotification({
    userId: friendId,
    type: 'friend_accept',
    fromUserId: userId,
    message: 'aceitou sua solicitação de amizade',
    read: false,
      createdAt: new Date(),
  });
};

export const rejectFriendRequest = async (userId: string, friendId: string) => {
  const batch = writeBatch(db);

  // Update status to rejected
  const friendshipId1 = `${userId}_${friendId}`;
  const friendshipRef1 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId1);
  batch.update(friendshipRef1, {
    status: 'rejected',
    updatedAt: serverTimestamp()
  });

  const friendshipId2 = `${friendId}_${userId}`;
  const friendshipRef2 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId2);
  batch.update(friendshipRef2, {
    status: 'rejected',
    updatedAt: serverTimestamp()
  });

  await batch.commit();
};

export const removeFriend = async (userId: string, friendId: string) => {
  const batch = writeBatch(db);

  // Delete both friendship documents
  const friendshipId1 = `${userId}_${friendId}`;
  const friendshipRef1 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId1);
  batch.delete(friendshipRef1);

  const friendshipId2 = `${friendId}_${userId}`;
  const friendshipRef2 = doc(db, COLLECTIONS.FRIENDSHIPS, friendshipId2);
  batch.delete(friendshipRef2);

  await batch.commit();
};

// ==================== FRIENDSHIP QUERIES ====================
export const getUserFriendsPaginated = async (
  userId: string, 
  limitCount: number = 30, 
  lastDoc?: DocumentSnapshot
): Promise<{
  friends: FriendshipWithUser[];
  lastDoc?: DocumentSnapshot;
  hasMore: boolean;
}> => {
  console.log('Função chamada com:', { userId, limitCount, lastDoc });
  
  let q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId),
    where('status', '==', 'accepted'),
    orderBy('friendshipDate', 'desc'),
    limit(limitCount)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
  
  // Get all friend IDs
  const friendIds = snapshot.docs.map(doc => doc.data().friendId);
  
  // Batch fetch friend user data
  const users = await getUsersBatch(friendIds);
  
  const friendsWithUsers = snapshot.docs.map(doc => {
    const friendship = doc.data() as Friendship;
    const friend = users.find(u => u.id === friendship.friendId);

    if (!friend) {
      console.error('Friend data not found for ID:', friendship.friendId);
      return null;
    }

    return {
      ...friendship,
      id: doc.id,
      friend
    } as FriendshipWithUser;
  }).filter((f): f is FriendshipWithUser => f !== null);

  return {
    friends: friendsWithUsers,
    lastDoc: newLastDoc,
    hasMore: snapshot.docs.length === limitCount
  };
};

export const getFriendRequests = async (userId: string): Promise<FriendshipWithUser[]> => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
    where('requestedBy', '!=', userId), // Requests received (not sent)
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const friendships: Friendship[] = [];
  snapshot.forEach(doc => {
    friendships.push({ id: doc.id, ...doc.data() } as Friendship);
  });

  // Get requester user data
  const requesterIds = friendships.map(f => f.requestedBy);
  const users = await getUsersBatch(requesterIds);

  return friendships.map(friendship => ({
    ...friendship,
    friend: users.find(u => u.id === friendship.requestedBy)!
  }));
};

export const getSentFriendRequests = async (userId: string): Promise<FriendshipWithUser[]> => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
    where('requestedBy', '==', userId), // Requests sent
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const friendships: Friendship[] = [];
  snapshot.forEach(doc => {
    friendships.push({ id: doc.id, ...doc.data() } as Friendship);
  });

  // Get recipient user data
  const recipientIds = friendships.map(f => f.friendId);
  const users = await getUsersBatch(recipientIds);

  return friendships.map(friendship => ({
    ...friendship,
    friend: users.find(u => u.id === friendship.friendId)!
  }));
};

export const getFriendshipStatus = async (
  currentUserId: string,
  targetUserId: string
): Promise<'none' | 'friend' | 'pending' | 'received' | 'following'> => {
  try {
    const friendshipRef = doc(db, COLLECTIONS.FRIENDSHIPS, `${currentUserId}_${targetUserId}`);
    const friendshipSnap = await getDoc(friendshipRef);

    if (!friendshipSnap.exists()) return 'none';

    const friendship = friendshipSnap.data() as Friendship;

    if (friendship.status === 'accepted') return 'friend';
    if (friendship.status === 'pending') {
      return friendship.requestedBy === currentUserId ? 'pending' : 'received';
    }

    return 'none';
  } catch (error) {
    console.error('Error checking friendship status:', error);
    return 'none';
  }
};

// ==================== REAL-TIME LISTENERS ====================
export const subscribeToFriendships = (
  userId: string,
  status: 'pending' | 'accepted',
  callback: (friendships: FriendshipWithUser[]) => void
) => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  );

  let active = true;
  let userCache = new Map<string, User>();

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    if (!active) return;

    const friendships: Friendship[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Friendship));

    // Batch fetch user data only for new users
    const newUserIds = friendships
      .map(f => status === 'pending' && f.requestedBy !== userId ? f.requestedBy : f.friendId)
      .filter(id => !userCache.has(id));

    if (newUserIds.length > 0) {
      const users = await getUsersBatch(newUserIds);
      users.forEach(user => userCache.set(user.id, user));
    }

    const friendshipsWithUsers: FriendshipWithUser[] = friendships.map(friendship => {
      const friendId = status === 'pending' && friendship.requestedBy !== userId 
        ? friendship.requestedBy 
        : friendship.friendId;
      
      return {
        ...friendship,
        friend: userCache.get(friendId)!
      };
    });

    callback(friendshipsWithUsers);
  });

  return () => {
    active = false;
    unsubscribe();
    userCache.clear();
  };
};

export const subscribeToFriendRequests = (
  userId: string,
  callback: (requests: FriendshipWithUser[]) => void
) => {
  return subscribeToFriendships(userId, 'pending', callback);
};

// ==================== COUNT QUERIES ====================
export const getFriendCount = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'accepted')
  );

  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

export const getPendingRequestCount = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
    where('requestedBy', '!=', userId)
  );

  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

// ==================== FOLLOW SYSTEM ====================
export const followUser = async (followerId: string, followedId: string) => {
  const batch = writeBatch(db);
  
  // Increment follower's following count
  const followerRef = doc(db, COLLECTIONS.USERS, followerId);
  batch.update(followerRef, {
    following: increment(1),
    updatedAt: serverTimestamp(),
  });
  
  // Increment followed user's followers count
  const followedRef = doc(db, COLLECTIONS.USERS, followedId);
  batch.update(followedRef, {
    followers: increment(1),
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
  
  await createNotification({
    userId: followedId,
    type: 'follow',
    fromUserId: followerId,
    message: 'começou a seguir você',
    read: false,
    createdAt: new Date(),
  });
};

export const unfollowUser = async (followerId: string, followedId: string) => {
  const batch = writeBatch(db);
  
  // Decrement follower's following count
  const followerRef = doc(db, COLLECTIONS.USERS, followerId);
  batch.update(followerRef, {
    following: increment(-1),
    updatedAt: serverTimestamp(),
  });
  
  // Decrement followed user's followers count
  const followedRef = doc(db, COLLECTIONS.USERS, followedId);
  batch.update(followedRef, {
    followers: increment(-1),
    updatedAt: serverTimestamp(),
  });
  
  await batch.commit();
};

// ==================== POST OPERATIONS ====================
export const createPost = async (postData: Omit<Post, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.POSTS), {
    ...postData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getPosts = async (lastDoc?: any, limitCount = 10) => {
  let q = query(
    collection(db, COLLECTIONS.POSTS),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const querySnapshot = await getDocs(q);
  const posts: Post[] = [];
  
  querySnapshot.forEach((doc) => {
    posts.push({ id: doc.id, ...doc.data() } as Post);
  });

  return {
    posts,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    hasMore: querySnapshot.docs.length === limitCount,
  };
};

export const likePost = async (postId: string, userId: string) => {
  const postRef = doc(db, COLLECTIONS.POSTS, postId);
  await updateDoc(postRef, {
    likes: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
};

export const unlikePost = async (postId: string, userId: string) => {
  const postRef = doc(db, COLLECTIONS.POSTS, postId);
  await updateDoc(postRef, {
    likes: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
};

export const addComment = async (postId: string, comment: Omit<Comment, 'id'>) => {
  const postRef = doc(db, COLLECTIONS.POSTS, postId);
  const commentData = {
    ...comment,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  await updateDoc(postRef, {
    comments: arrayUnion(commentData),
    updatedAt: serverTimestamp(),
  });
};

// ==================== BOOK OPERATIONS ====================
export const createBook = async (bookData: Omit<Book, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.BOOKS), {
    ...bookData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const searchBooks = async (searchTerm: string, limitCount = 20) => {
  const q = query(
    collection(db, COLLECTIONS.BOOKS),
    where('title', '>=', searchTerm),
    where('title', '<=', searchTerm + '\uf8ff'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const books: Book[] = [];
  
  querySnapshot.forEach((doc) => {
    books.push({ id: doc.id, ...doc.data() } as Book);
  });

  return books;
};

// ==================== USER BOOKS OPERATIONS ====================
export const addBookToShelf = async (userBookData: Omit<UserBook, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.USER_BOOKS), {
    ...userBookData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getUserBooks = async (userId: string, status?: UserBook['status']) => {
  let q = query(
    collection(db, COLLECTIONS.USER_BOOKS),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  if (status) {
    q = query(q, where('status', '==', status));
  }

  const querySnapshot = await getDocs(q);
  const userBooks: UserBook[] = [];
  
  querySnapshot.forEach((doc) => {
    userBooks.push({ id: doc.id, ...doc.data() } as UserBook);
  });

  return userBooks;
};

export const updateUserBook = async (userBookId: string, updates: Partial<UserBook>) => {
  const docRef = doc(db, COLLECTIONS.USER_BOOKS, userBookId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// ==================== NOTIFICATION OPERATIONS ====================
export const createNotification = async (notificationData: Omit<Notification, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
    ...notificationData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getUserNotifications = async (userId: string, limitCount = 20) => {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const notifications: Notification[] = [];
  
  querySnapshot.forEach((doc) => {
    notifications.push({ id: doc.id, ...doc.data() } as Notification);
  });

  return notifications;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const docRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
  await updateDoc(docRef, {
    read: true,
  });
};

export const subscribeToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
) => {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const notifications: Notification[] = [];
    querySnapshot.forEach((doc) => {
      notifications.push({ id: doc.id, ...doc.data() } as Notification);
    });
    callback(notifications);
  });
};

// ==================== AVATAR OPERATIONS ====================
export const saveUserAvatar = async (
  userId: string, 
  avatarData: {
    originalUrl: string;
    croppedUrl: string;
    isPublic?: boolean;
    cropData: {
      x: number;
      y: number;
      zoom: number;
      croppedArea: any;
    };
  }
) => {
  const avatarRef = doc(collection(db, COLLECTIONS.USER_AVATARS));
  await setDoc(avatarRef, {
    userId,
    ...avatarData,
    isPublic: avatarData.isPublic || false,
    uploadedAt: serverTimestamp(),
    isCurrent: true,
    likes: [],
    comments: [],
  });

  // Mark other avatars as not current
  const userAvatarsQuery = query(
    collection(db, COLLECTIONS.USER_AVATARS),
    where('userId', '==', userId),
    where('isCurrent', '==', true)
  );
  
  const existingAvatars = await getDocs(userAvatarsQuery);
  const batch = writeBatch(db);
  
  existingAvatars.forEach((doc) => {
    if (doc.id !== avatarRef.id) {
      batch.update(doc.ref, { isCurrent: false });
    }
  });
  
  await batch.commit();
};

export const getUserAvatars = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.USER_AVATARS),
    where('userId', '==', userId),
    orderBy('uploadedAt', 'desc'),
    limit(20)
  );

  const querySnapshot = await getDocs(q);
  const avatars: any[] = [];
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    avatars.push({
      id: doc.id,
      ...data,
      uploadedAt: data.uploadedAt?.toDate() || new Date(),
    });
  });

  return avatars;
};

export const createAvatarPost = async (userId: string, avatarUrl: string) => {
  const postRef = await addDoc(collection(db, COLLECTIONS.POSTS), {
    userId,
    content: 'Atualizou a foto do perfil',
    type: 'avatar_update',
    mediaUrls: [avatarUrl],
    likes: [],
    comments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return postRef.id;
};

export const likeAvatar = async (avatarId: string, userId: string) => {
  const avatarRef = doc(db, COLLECTIONS.USER_AVATARS, avatarId);
  
  const avatarDoc = await getDoc(avatarRef);
  if (avatarDoc.exists()) {
    const data = avatarDoc.data();
    const likes = data.likes || [];
    
    if (likes.includes(userId)) {
      await updateDoc(avatarRef, {
        likes: arrayRemove(userId),
      });
    } else {
      await updateDoc(avatarRef, {
        likes: arrayUnion(userId),
      });
    }
  }
};

export const commentOnAvatar = async (avatarId: string, comment: Omit<Comment, 'id'>) => {
  const avatarRef = doc(db, COLLECTIONS.USER_AVATARS, avatarId);

  const commentId = Date.now().toString();
  const commentData = {
    ...comment,
    id: commentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await updateDoc(avatarRef, {
    comments: arrayUnion(commentData)
  });
};

// ==================== FEED SUBSCRIPTIONS ====================
export const subscribeToFeedPosts = (
  callback: (posts: Post[]) => void,
  limitCount = 10
) => {
  const q = query(
    collection(db, COLLECTIONS.POSTS),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (querySnapshot) => {
    const posts: Post[] = [];
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });
    callback(posts);
  });
};

// ==================== MENTIONS OPERATIONS ====================
export const searchUsersForMention = async (
  searchTerm: string
): Promise<{ id: string; label: string; nickname: string; photoURL: string }[]> => {
  const lowerCaseSearchTerm = searchTerm.toLowerCase();
  const usersRef = collection(db, COLLECTIONS.USERS);

  // # atualizado: Busca mesmo se searchTerm for vazio
  const q =
    lowerCaseSearchTerm.length > 0
      ? query(
          usersRef,
          where('nickname', '>=', lowerCaseSearchTerm),
          where('nickname', '<=', lowerCaseSearchTerm + '\uf8ff'),
          limit(5)
        )
      : query(usersRef, limit(5));

  try {
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.displayName, // Nome completo (para a lista)
        nickname: data.nickname, // Nickname (para o link e texto)
        photoURL: data.photoURL || '', // # atualizado
      };
    });

    return users;
  } catch (error) {
    console.error('Erro ao buscar usuários para menção: ', error);
    return [];
  }
};
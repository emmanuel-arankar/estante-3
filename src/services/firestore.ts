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
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  setDoc,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  User,
  Book,
  UserBook,
  Friendship,
  FriendshipWithUser
} from '@estante/common-types';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  BOOKS: 'books',
  USER_BOOKS: 'userBooks',
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
    friendsCount: 0,
    pendingRequestsCount: 0,
    sentRequestsCount: 0,
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

/**
 * Inscreve-se em solicitações de amizade RECEBIDAS (não enviadas)
 * Filtra apenas onde requestedBy !== userId para mostrar apenas pedidos recebidos
 * Nota: Filtragem feita no client-side para evitar necessidade de índice composto
 */
export const subscribeToFriendRequests = (
  userId: string,
  callback: (requests: FriendshipWithUser[]) => void
) => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  let active = true;
  let userCache = new Map<string, User>();

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    if (!active) return;

    // Filtrar apenas solicitações RECEBIDAS (onde requestedBy !== userId)
    const friendships: Friendship[] = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Friendship))
      .filter(f => f.requestedBy !== userId);

    // Batch fetch user data only for new users (who sent the request)
    const newUserIds = friendships
      .map(f => f.requestedBy)
      .filter(id => !userCache.has(id));

    if (newUserIds.length > 0) {
      const users = await getUsersBatch(newUserIds);
      users.forEach(user => userCache.set(user.id, user));
    }

    const friendshipsWithUsers: FriendshipWithUser[] = friendships.map(friendship => ({
      ...friendship,
      friend: userCache.get(friendship.requestedBy)!
    }));

    callback(friendshipsWithUsers);
  });

  return () => {
    active = false;
    unsubscribe();
    userCache.clear();
  };
};

// ==================== COUNT QUERIES ====================
/**
 * Conta solicitações RECEBIDAS (não enviadas)
 * Nota: Como não podemos usar != com getCountFromServer sem índice composto,
 * buscamos os docs e filtramos no client-side
 */
export const getPendingRequestCount = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDSHIPS),
    where('userId', '==', userId),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  // Filtrar apenas solicitações RECEBIDAS (onde requestedBy !== userId)
  const receivedRequests = snapshot.docs.filter(doc => doc.data().requestedBy !== userId);
  return receivedRequests.length;
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
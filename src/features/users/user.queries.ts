import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User } from '../../models';

/**
 * Definição de query reutilizável para buscar um usuário pelo ID.
 * Usada para pré-aquecer o cache ou buscar dados em loaders/actions.
 */
export const userQuery = (userId: string) => ({
  queryKey: ['users', userId],
  queryFn: async (): Promise<User> => {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Response('Not Found', { status: 404 });
    }
    return { id: docSnap.id, ...docSnap.data() } as User;
  },
});

/**
 * Definição de query reutilizável para buscar um usuário pelo nickname.
 */
export const userByNicknameQuery = (nickname: string) => ({
  queryKey: ['users', 'nickname', nickname],
  queryFn: async (): Promise<User> => {
    const q = query(collection(db, 'users'), where('nickname', '==', nickname));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Response('Not Found', { status: 404, statusText: 'User not found' });
    }
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
  },
});

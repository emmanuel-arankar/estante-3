import { redirect } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseAuthProfile,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore'; // # atualizado: importado getDoc
import { auth, db } from '../../services/firebase';
import { generateNickname, generateUniqueNickname } from '../../utils/nickname';
import { queryClient } from '../../lib/queryClient';
import { toastErrorClickable, toastSuccessClickable } from '../../components/ui/toast'; // # atualizado: importado toastSuccessClickable
import { User } from '../../models';
import { PATHS } from '../../router/paths';
import { useAuthStore } from '../../stores/authStore';

export const loginAction = async ({ request }: any) => {
  const formData = await request.formData();
  const { email, password, redirectTo } = Object.fromEntries(formData);

  try {
    useAuthStore.getState().setIsLoadingProfile(true, 'Autenticando...');
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email as string,
      password as string
    );
    const user = userCredential.user;

    // # atualizado: Verifica se o perfil existe no Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    let profileData;

    if (!docSnap.exists()) {
      // Se não existir, cria o perfil (recuperação de falha no registro)
      console.warn(`Documento não encontrado para o usuário ${user.uid}. Criando agora...`);
      const nickname = await generateUniqueNickname(user.displayName || 'Leitor');
      const newProfileData: Omit<User, 'id'> = {
        displayName: user.displayName || 'Novo Leitor',
        nickname,
        email: user.email!,
        photoURL: user.photoURL || '',
        bio: '',
        location: '',
        website: '',
        joinedAt: new Date(),
        booksRead: 0,
        currentlyReading: 0,
        followers: 0,
        following: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: 'user', // # atualizado
      };

      await setDoc(userDocRef, newProfileData);
      profileData = { id: user.uid, ...newProfileData };
      toastSuccessClickable(`Finalizamos a criação da sua conta, ${user.displayName}!`);
    } else {
      // Se existir, apenas carrega os dados
      profileData = { id: docSnap.id, ...docSnap.data() } as User;
    }

    queryClient.setQueryData(['users', user.uid], profileData);
    sessionStorage.setItem('showLoginSuccessToast', `Bem-vindo(a) de volta, ${profileData.displayName}!`);

    const finalRedirectTo = (redirectTo as string) === '/' ? PATHS.PROFILE_ME : (redirectTo as string);
    return redirect(finalRedirectTo);
  } catch (error: any) {
    useAuthStore.getState().setIsLoadingProfile(false);
    toastErrorClickable('Email ou senha inválidos.');
    return { error: 'Falha no login' };
  }
};

export const registerAction = async ({ request }: any) => {
  const formData = await request.formData();
  const { email, password, displayName } = Object.fromEntries(formData);
  let userCredential;

  try {
    useAuthStore.getState().setIsLoadingProfile(true, 'Criando sua conta...');
    userCredential = await createUserWithEmailAndPassword(
      auth,
      email as string,
      password as string
    );
    const user = userCredential.user;
    await updateFirebaseAuthProfile(user, { displayName: displayName as string });

    // # atualizado: Lógica de criação de usuário movida para dentro de uma transação
    await runTransaction(db, async (transaction) => {
      let nickname = generateNickname(displayName as string);
      let isNicknameAvailable = false;
      let attempts = 0;
      
      // Tenta encontrar um nickname único dentro da transação
      while (!isNicknameAvailable && attempts < 10) {
        const nicknameRef = doc(db, 'nicknames', nickname);
        const nicknameDoc = await transaction.get(nicknameRef);
        
        if (!nicknameDoc.exists()) {
          isNicknameAvailable = true;
          transaction.set(nicknameRef, { userId: user.uid }); // Reserva o nickname
        } else {
          nickname = `${generateNickname(displayName as string)}-${attempts + 1}`;
          attempts++;
        }
      }

      if (!isNicknameAvailable) {
        throw new Error('Não foi possível gerar um nickname único.');
      }
      
      const newProfileData: Omit<User, 'id'> = {
        displayName: displayName as string,
        nickname,
        email: email as string,
        photoURL: user.photoURL || '',
        bio: '',
        location: '',
        website: '',
        joinedAt: new Date(),
        booksRead: 0,
        currentlyReading: 0,
        followers: 0,
        following: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: 'user',
      };
      
      // Cria o documento do usuário
      const userDocRef = doc(db, 'users', user.uid);
      transaction.set(userDocRef, newProfileData);
      
      // Atualiza o cache do React Query
      queryClient.setQueryData(['users', user.uid], {
        id: user.uid,
        ...newProfileData,
      });
    });

    sessionStorage.setItem('showLoginSuccessToast', `Conta criada com sucesso, ${displayName}!`);
    return redirect(PATHS.PROFILE_ME);
  } catch (error: any) {
    console.error('Erro no registro:', error);

    if (userCredential && userCredential.user) {
      console.warn(`Iniciando rollback para o usuário: ${userCredential.user.uid}`);
      await deleteUser(userCredential.user).catch(deleteError => {
        console.error("Falha no rollback, usuário pode precisar ser removido manualmente:", deleteError);
      });
    }
    
    useAuthStore.getState().setIsLoadingProfile(false);
    toastErrorClickable(
      error.message === 'Não foi possível gerar um nickname único.' 
      ? error.message 
      : 'Não foi possível criar a conta. O email já pode estar em uso.'
    );
    return { error: 'Falha no registro' };
  }
};
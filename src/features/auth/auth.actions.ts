import { redirect } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseAuthProfile,
  deleteUser,
} from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
import {
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';
import { generateNickname } from '@/utils/nickname';
import { User } from '@estante/common-types';
import { userQuery } from '@/features/users/user.queries'; // Adicionado import que faltava

export const loginAction = async ({ request }: any) => {
  const formData = await request.formData();
  const { email, password, redirectTo, rememberMe } = Object.fromEntries(formData);
  const isRememberMe = rememberMe === 'true';

  try {
    useAuthStore.getState().setIsLoadingProfile(true, 'Autenticando...');

    // Salvar preferência de "Lembrar de mim" no localStorage para o useAuth hook usar
    if (isRememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }

    // 1. Autenticar no Firebase (necessário)
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email as string,
      password as string
    );
    const user = userCredential.user;

    // 2. Atualizar store imediatamente com o user do Firebase
    //    Isso permite que o Header saiba que está autenticado
    useAuthStore.getState().setUser(user);

    // 3. Iniciar prefetch do perfil em BACKGROUND (não bloqueia redirect!)
    //    O perfil será carregado pelo layoutLoader ou pelo useAuth hook
    queryClient.prefetchQuery(userQuery(user.uid)).catch(console.error);

    // 4. Guardar mensagem de sucesso para mostrar após redirect
    sessionStorage.setItem('showLoginSuccessToast', `Bem-vindo(a) de volta!`);

    // 5. REDIRECT IMEDIATO! Não espera o perfil carregar
    const finalRedirectTo = (redirectTo as string) === '/' ? PATHS.PROFILE_ME : (redirectTo as string);
    return redirect(finalRedirectTo);
  } catch (error: any) {
    useAuthStore.getState().setIsLoadingProfile(false);

    // # atualizado: Lógica de erro detalhada
    let errorMessage = 'Ocorreu um erro ao tentar fazer login.';

    if (error.code) {
      switch (error.code) {
        case 'auth/invalid-login-credentials':
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorMessage = 'E-mail ou senha inválidos.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas de login falharam. Por favor, tente novamente mais tarde.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erro de rede. Verifique sua conexão com a internet.';
          break;
        default:
          console.error('Erro de login não tratado:', error); // Log para o console
          errorMessage = 'Ocorreu um erro inesperado. Tente novamente.';
      }
    } else {
      console.error('Erro de login desconhecido:', error);
    }

    toastErrorClickable(errorMessage);
    return { error: errorMessage }; // Retorna a mensagem de erro real
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
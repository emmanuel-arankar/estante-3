import { redirect } from 'react-router-dom';
import {
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { useAuthStore } from '@/stores/authStore';
import { userQuery } from '@/features/users/user.queries';
import { loginAPI, registerAPI } from '@/services/api/authApi';
import { signInWithToken } from '@/services/firebase/auth';

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

    // 1. Autenticar no Backend para receber Custom Token
    const authResponse = await loginAPI({ email, password });
    if (!authResponse.customToken) {
      throw new Error('Token de autenticação não recebido.');
    }

    // 2. Fazer login no Firebase cliente
    const userCredential = await signInWithToken(authResponse.customToken);
    const user = userCredential.user;

    // 3. Atualizar store imediatamente com o user do Firebase
    //    Isso permite que o Header saiba que está autenticado
    useAuthStore.getState().setUser(user);

    // 4. Iniciar prefetch do perfil em BACKGROUND (não bloqueia redirect!)
    //    O perfil será carregado pelo layoutLoader ou pelo useAuth hook
    queryClient.prefetchQuery(userQuery(user.uid)).catch(console.error);

    // 5. Guardar mensagem de sucesso para mostrar após redirect
    sessionStorage.setItem('showLoginSuccessToast', `Bem-vindo(a) de volta!`);

    // 6. REDIRECT IMEDIATO! Não espera o perfil carregar
    const finalRedirectTo = (redirectTo as string) === '/' ? PATHS.PROFILE_ME : (redirectTo as string);
    return redirect(finalRedirectTo);
  } catch (error: any) {
    useAuthStore.getState().setIsLoadingProfile(false);
    console.error('Erro de login:', error);

    const errorMessage = error.message || 'Ocorreu um erro ao tentar fazer login.';

    toastErrorClickable(errorMessage);
    return { error: errorMessage }; // Retorna a mensagem de erro real
  }
};

export const registerAction = async ({ request }: any) => {
  const formData = await request.formData();
  const { email, password, displayName } = Object.fromEntries(formData);

  try {
    useAuthStore.getState().setIsLoadingProfile(true, 'Criando sua conta...');

    // 1. Registrar no Backend
    const authResponse = await registerAPI({ email, password, displayName });
    if (!authResponse.customToken) {
      throw new Error('Token de autenticação não recebido.');
    }

    // 2. Fazer login no Firebase SDK localmente
    await signInWithToken(authResponse.customToken);

    sessionStorage.setItem('showLoginSuccessToast', `Conta criada com sucesso, ${displayName}!`);
    return redirect(PATHS.PROFILE_ME);
  } catch (error: any) {
    console.error('Erro no registro:', error);
    useAuthStore.getState().setIsLoadingProfile(false);

    const errorMessage = error.message || 'Não foi possível criar a conta.';
    toastErrorClickable(errorMessage);
    return { error: 'Falha no registro' };
  }
};

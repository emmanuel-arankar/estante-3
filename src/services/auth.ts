import {
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  signInWithPopup,
  signInWithCustomToken,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';

export type { FirebaseUser };
export { GoogleAuthProvider };

/**
 * Wrapper para login com pop-up (ex: Google)
 */
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

/**
 * Wrapper para login com Custom Token
 */
export const signInWithToken = async (customToken: string) => {
  return signInWithCustomToken(auth, customToken);
};

/**
 * Wrapper para observar o estado de autenticação
 */
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
import {
  toastSuccessClickable,
  toastErrorClickable
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { auth } from '@/services/firebase';
import { setUserOffline } from '@/services/realtime';
import { useAuthStore } from '@/stores/authStore';

/**
 * Envia o ID token para o backend para criar um cookie de sessão.
 * @param idToken O ID token do usuário.
 */
export const setSessionCookie = async (idToken: string, rememberMe: boolean = false) => {
  try {
    // # atualizado - Envia rememberMe para o backend
    const response = await fetch('/api/sessionLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Essencial para cookies serem enviados/recebidos
      body: JSON.stringify({ idToken, rememberMe }),
    });

    if (!response.ok) {
      const error: any = new Error('Falha ao definir o cookie de sessão.');
      error.status = response.status;
      throw error;
    }
  } catch (error) {
    console.error('Falha ao definir o cookie de sessão:', error);
    throw error;
  }
};

/**
 * Envia uma requisição para o backend para limpar o cookie de sessão.
 */
export const clearSessionCookie = async () => {
  try {
    // # atualizado - Usa o caminho relativo da API
    await fetch('/api/sessionLogout', {
      method: 'POST',
      credentials: 'include' // Essencial para enviar o cookie de sessão
    });
  } catch (error) {
    console.error('Falha ao limpar o cookie de sessão:', error);
  }
};

export const logout = async () => {
  try {
    console.log('🚪 Iniciando logout...');

    // 1. Limpeza VISUAL imediata (Optimistic Logout)
    // Garante que o Header mude para "Entrar" instantaneamente
    useAuthStore.getState().clearAuth();

    // 2. Operações de rede em background
    const logoutPromises: Promise<any>[] = [
      fetch('/api/sessionLogout', {
        method: 'POST',
        credentials: 'include'
      }).catch(err => console.error("Session logout error", err)),
      signOut(auth).catch(err => console.error("Firebase signOut error", err)),
      // 2.1 Limpeza de Presença via API
      setUserOffline(auth.currentUser?.uid || '').catch(err => console.error("Presence logout error", err))
    ];

    await Promise.all(logoutPromises);

    // 3. Limpeza final (localStorage e cache de dados)
    localStorage.removeItem('session');
    localStorage.removeItem('rememberMe');
    queryClient.clear();

    console.log('✅ Logout realizado com sucesso');
    toastSuccessClickable('Logout realizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao fazer logout:', error);
    // Mesmo com erro, forçamos a limpeza visual para não prender o usuário
    useAuthStore.getState().clearAuth();
    toastErrorClickable('Erro ao fazer logout, mas sua sessão local foi encerrada.');
  }
};

let authReadyResolved = false;

const authReadyPromise = new Promise<FirebaseUser | null>(resolve => {
  const unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe();
    authReadyResolved = true;
    resolve(user);
  });
});

/**
 * Aguarda o Firebase Auth estar pronto.
 * Primeiro verifica se já temos um usuário em cache,
 * depois aguarda a promise inicial ou verifica auth.currentUser.
 */
export const awaitAuthReady = async (): Promise<FirebaseUser | null> => {
  // Se já resolvemos a promise inicial, verificar o estado atual
  if (authReadyResolved) {
    // Se o auth.currentUser já existe, retornamos ele
    if (auth.currentUser) {
      return auth.currentUser;
    }
    // Se não há usuário atual mas temos cache, algo mudou - aguardar um ciclo
    return new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, user => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  // Primeira vez - aguardar a promise original
  return authReadyPromise;
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export const isAuthenticated = (): boolean => {
  const user = getCurrentUser();
  return !!user;
};

export const getUserRoles = async () => {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    // Força a atualização do token para garantir que as claims mais recentes sejam obtidas
    const tokenResult = await getIdTokenResult(user, true);
    // As custom claims estarão disponíveis em tokenResult.claims
    return tokenResult.claims as { [key: string]: boolean }; // Ex: { admin: true }
  } catch (error) {
    console.error("Erro ao obter as permissões do usuário:", error);
    return null;
  }
};
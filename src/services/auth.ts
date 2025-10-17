import {
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { useAuthStore } from '../stores/authStore';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';

/**
 * Envia o ID token para o backend para criar um cookie de sessão.
 * @param idToken O ID token do usuário.
 */
export const setSessionCookie = async (idToken: string) => {
  try {
    // # atualizado - Usa o caminho relativo da API
    const response = await fetch('/api/sessionLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
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
    await fetch('/api/sessionLogout', { method: 'POST' });
  } catch (error) {
    console.error('Falha ao limpar o cookie de sessão:', error);
  }
};

export const logout = async () => {
  try {
    console.log('🚪 Iniciando logout...');

    // Chama a função de logout do backend para limpar o cookie
    await fetch('/api/sessionLogout', { method: 'POST' });

    // Limpa o estado local
    await signOut(auth);
    localStorage.removeItem('session');
    useAuthStore.getState().clearAuth();
    queryClient.clear();

    console.log('✅ Logout realizado com sucesso');
    toastSuccessClickable('Logout realizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao fazer logout:', error);
    toastErrorClickable('Erro ao fazer logout. Tente novamente.');
    throw error;
  }
};

const authReadyPromise = new Promise<FirebaseUser | null>(resolve => {
  const unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe();
    resolve(user);
  });
});

export const awaitAuthReady = () => authReadyPromise;

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
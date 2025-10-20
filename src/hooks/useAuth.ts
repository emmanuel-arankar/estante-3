import { useEffect } from 'react';
// # atualizado: Adicionar signOut
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { setSessionCookie } from '@/services/auth';

export const useAuth = () => {
  const {
    user,
    loading,
    error,
    setUser,
    setLoading,
  } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true);
          await setSessionCookie(idToken);
        } catch (err: any) {
          console.error("Erro ao tentar definir o cookie de sessão:", err.message);
          // # ATUALIZADO: Apenas desloga se o erro for especificamente 'Não autorizado' (401)
          if (err.status === 401) {
            console.warn("Usuário dessincronizado detectado (401). Forçando logout para ressincronizar.");
            await signOut(auth);
          }
        }
      } else {
        await fetch('/api/sessionLogout', { method: 'POST' });
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return { user, loading, error };
};
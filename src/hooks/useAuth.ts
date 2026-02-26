import { useEffect } from 'react';
import { onAuthChange, setSessionCookie } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import { userQuery } from '@/features/users/user.queries';

// Rastreia o último UID para o qual criamos cookie de sessão
// Evita chamadas repetidas ao /api/sessionLogin
let lastSessionUid: string | null = null;
let sessionCookieInProgress = false; // Evita race condition entre múltiplos listeners

export const useAuth = () => {
  const {
    user,
    loading,
    error,
    setUser,
    setLoading,
    setError,
    clearAuth,
  } = useAuthStore();

  useEffect(() => {
    // Timeout de segurança: Se o Firebase não inicializar em 2.5s, libera a UI
    // Isso evita o "loop eterno" em conexões lentas ou acesso via IP
    const safetyTimeout = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        console.warn("Auth check timeout - forçando liberação da UI (assumindo deslogado)");
        setLoading(false);
      }
    }, 2500);

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      // Se o Firebase respondeu, cancelamos o timeout de segurança
      clearTimeout(safetyTimeout);

      try {
        if (firebaseUser) {
          // Iniciar prefetch do perfil ANTES de esperar o cookie (em paralelo!)
          queryClient.prefetchQuery(userQuery(firebaseUser.uid)).catch(console.error);

          // Criar cookie de sessão apenas se for um novo login (UID diferente)
          // Evita chamadas repetidas ao /api/sessionLogin a cada disparo do listener
          // sessionCookieInProgress evita race condition entre múltiplos listeners
          if (lastSessionUid !== firebaseUser.uid && !sessionCookieInProgress) {
            sessionCookieInProgress = true;
            try {
              const idToken = await firebaseUser.getIdToken(true);
              const rememberMe = localStorage.getItem('rememberMe') === 'true';
              await setSessionCookie(idToken, rememberMe);
              lastSessionUid = firebaseUser.uid;
            } finally {
              sessionCookieInProgress = false;
            }
          }

          // Definir usuário no store
          setUser(firebaseUser);

          // Carregar perfil completo do Firestore e sincronizar
          queryClient.fetchQuery(userQuery(firebaseUser.uid)).then((profile: any) => {
            if (profile) {
              // Atualiza o perfil global (corrige foto/nome no Header)
              useAuthStore.getState().setUserProfile(profile);
            }
          }).catch((err) => {
            console.error("Erro ao carregar perfil no useAuth:", err);
          });
        } else {
          // Usuário está nulo (deslogado)
          lastSessionUid = null; // Permite criar novo cookie no próximo login
          clearAuth();
          // Logout do backend de forma resiliente
          fetch('/api/sessionLogout', { method: 'POST' }).catch(() => { });
        }
      } catch (err: any) {
        console.error("Erro crítico no hook useAuth:", err);
        setError(err.message || "Erro de autenticação.");
        clearAuth();
      } finally {
        // GARANTIDO: O loading SEMPRE para aqui
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, setLoading, setError, clearAuth]);

  return { user, loading, error };
};
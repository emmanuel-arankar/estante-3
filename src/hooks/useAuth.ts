import { useEffect } from 'react';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { setSessionCookie } from '@/services/auth';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import { userQuery } from '@/features/users/user.queries';

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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Se o Firebase respondeu, cancelamos o timeout de segurança
      clearTimeout(safetyTimeout);

      try {
        if (firebaseUser) {
          // Iniciar prefetch do perfil ANTES de esperar o cookie (em paralelo!)
          queryClient.prefetchQuery(userQuery(firebaseUser.uid)).catch(console.error);

          try {
            // Criar cookie de sessão (necessário para API calls)
            const idToken = await firebaseUser.getIdToken(true);
            const rememberMe = localStorage.getItem('rememberMe') === 'true';
            await setSessionCookie(idToken, rememberMe);
          } catch (cookieErr) {
            console.error("Erro ao definir cookie de sessão:", cookieErr);
            // Não bloqueamos a UI por erro de cookie, apenas logamos
          }

          // Definir usuário no store
          setUser(firebaseUser);

          // Carregar perfil completo do Firestore e sincronizar
          queryClient.fetchQuery(userQuery(firebaseUser.uid)).then((profile: any) => {
            if (profile) {
              // Atualiza o perfil global (corrige foto/nome no Header)
              useAuthStore.getState().setUserProfile(profile);

              // # AUTO-CORREÇÃO (Self-Healing):
              if (profile.displayName && !firebaseUser.displayName) {
                console.log("🛠️ Sincronizando displayName ausente no Auth...");
                updateProfile(firebaseUser, { displayName: profile.displayName }).catch(console.error);
              }
            }
          }).catch((err) => {
            console.error("Erro ao carregar perfil no useAuth:", err);
          });
        } else {
          // Usuário está nulo (deslogado)
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
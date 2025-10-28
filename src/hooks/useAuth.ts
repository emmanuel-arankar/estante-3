import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { setSessionCookie } from '@/services/auth';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';

export const useAuth = () => {
  const {
    user,
    loading,
    error,
    setUser,
    setLoading,
    // # atualizado: Importar setError e clearAuth do seu store
    setError,
    clearAuth,
  } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
      if (firebaseUser) {
        // # atualizado: Não setar o usuário ainda. 
        // Primeiro, garantimos que a sessão backend pode ser criada.
        
        try {
          const idToken = await firebaseUser.getIdToken(true);
          await setSessionCookie(idToken);
          
          // # atualizado: Sucesso! Agora sim definimos o usuário.
          setUser(firebaseUser);

        } catch (err: any) {
          console.error("Erro ao tentar definir o cookie de sessão:", err.message);
          
          // # atualizado: Checar por 401 (Não autorizado) OU 429 (Rate Limit)
          if (err.status === 401 || err.status === 429) {
            
            if (err.status === 429) {
              console.warn("Muitas tentativas de login (429). Forçando logout.");
              setError("Muitas tentativas de login. Tente novamente mais tarde.");
            } else {
              console.warn("Usuário dessincronizado detectado (401). Forçando logout.");
              setError("Sessão inválida. Faça login novamente.");
            }
            
            // Força o logout do cliente para sincronizar com o backend
            await signOut(auth); 
            // O signOut vai disparar o onAuthStateChanged de novo,
            // que vai cair no 'else' abaixo e limpar o estado.

          } else {
            // Outro erro de rede, etc.
            setError(err.message || "Erro de conexão ao autenticar.");
            // # atualizado: Definimos o usuário como nulo aqui também
            clearAuth();
          }
        }
      } else {
        // Usuário está nulo (deslogado)
        // # atualizado: Usar clearAuth para limpar o estado
        clearAuth(); 
        await fetch('/api/sessionLogout', { method: 'POST' });
      }
      
      // # atualizado: Garantir que o loading pare no final de tudo
      setLoading(false);
    });

    return () => unsubscribe();
    // # atualizado: Adicionar as novas dependências do store
  }, [setUser, setLoading, setError, clearAuth]);

  return { user, loading, error };
};
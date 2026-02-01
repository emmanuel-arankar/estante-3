import { getPendingRequestCount } from '@/services/firestore';
import {
  awaitAuthReady,
  getCurrentUser
} from '@/services/auth';
import { queryClient } from '@/lib/queryClient';
import { userQuery } from '@/features/users/user.queries';
import { useAuthStore } from '@/stores/authStore';

/**
 * Layout Loader otimizado:
 * - Prioriza auth do store (instantâneo após login)
 * - Busca dados em PARALELO
 * - Sincroniza userProfile com o store global
 */
export const layoutLoader = async () => {
  // 1. Tentar pegar usuário direto do store (mais rápido após loginAction)
  let user = useAuthStore.getState().user;

  // 2. Se não tiver no store, aguardar Firebase (caso de refresh/inicialização)
  if (!user) {
    await awaitAuthReady();
    user = getCurrentUser();
  }

  if (!user) {
    // Usuário não logado - retorna dados vazios imediatamente
    return { userProfile: null, initialFriendRequests: 0 };
  }

  try {
    // Buscar dados em PARALELO (não sequencial) - muito mais rápido!
    const [userProfile, initialFriendRequests] = await Promise.all([
      queryClient.ensureQueryData(userQuery(user.uid)),
      getPendingRequestCount(user.uid).catch(() => 0) // Fallback em caso de erro
    ]);

    // 3. Importante: Sincronizar userProfile carregado com o store global
    // Isso permite que componentes usem useAuthStore().userProfile
    useAuthStore.getState().setUserProfile(userProfile);

    return { userProfile, initialFriendRequests };
  } catch (error) {
    console.error("Layout loader error:", error);
    return { userProfile: null, initialFriendRequests: 0 };
  }
};

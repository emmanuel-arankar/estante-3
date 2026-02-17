import { redirect } from 'react-router-dom';
import { toastErrorClickable } from '@/components/ui/toast';
import {
  userByNicknameQuery,
  userQuery
} from '@/features/users/user.queries';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { getCurrentUser } from '@/services/auth';
import { getUserProfileAPI } from '@/services/usersApi';

/**
 * Loader de perfil público:
 * Aguarda os dados do perfil antes de renderizar a página.
 * Isso evita o "flash" de skeletons após a navegação.
 * 
 * Agora usa o endpoint protegido /api/users/:userId que verifica bloqueio.
 */
export const profileLoader = async ({ params }: any) => {
  const { nickname } = params;
  if (!nickname) return redirect(PATHS.HOME);

  try {
    // Primeiro buscar o usuário pelo nickname para obter o ID
    const profileUser = await queryClient.ensureQueryData(userByNicknameQuery(nickname));

    // Agora buscar através do endpoint protegido para verificar bloqueio
    try {
      const protectedProfile = await getUserProfileAPI(profileUser.id);
      // Combinar dados do Firestore com os do endpoint (o endpoint retorna dados básicos)
      return { profileUser: { ...profileUser, ...protectedProfile } };
    } catch (apiError: any) {
      // Se erro 403 = bloqueado
      if (apiError?.response?.status === 403) {
        toastErrorClickable('Este perfil não está disponível');
        return redirect(PATHS.HOME);
      }
      // Para outros erros, usar dados do Firestore diretamente (fallback)
      console.warn('Erro ao verificar bloqueio, usando dados diretos:', apiError);
      return { profileUser };
    }
  } catch (error) {
    console.error('Loader error:', error);
    toastErrorClickable('Usuário não encontrado.');
    return redirect(PATHS.HOME);
  }
};

/**
 * Loader de perfil do usuário logado:
 * Aguarda os dados do perfil antes de renderizar.
 */
export const meProfileLoader = async () => {
  const user = getCurrentUser();
  if (!user) return redirect(PATHS.LOGIN);

  try {
    const profileUser = await queryClient.ensureQueryData(userQuery(user.uid));
    return { profileUser };
  } catch (error) {
    console.error('MeProfile Loader error:', error);
    return redirect(PATHS.LOGIN);
  }
};

export const editProfileLoader = async () => {
  const user = getCurrentUser();
  if (!user) return redirect(PATHS.LOGIN);
  return await queryClient.ensureQueryData(userQuery(user.uid));
};

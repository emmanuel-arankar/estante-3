import { redirect } from 'react-router-dom';
import { toastErrorClickable } from '@/components/ui/toast';
import {
  userByNicknameQuery,
  userQuery
} from '@/features/users/user.queries';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { getCurrentUser } from '@/services/auth';

/**
 * Loader de perfil público:
 * Aguarda os dados do perfil antes de renderizar a página.
 * Isso evita o "flash" de skeletons após a navegação.
 */
export const profileLoader = async ({ params }: any) => {
  const { nickname } = params;
  if (!nickname) return redirect(PATHS.HOME);

  try {
    const profileUser = await queryClient.ensureQueryData(userByNicknameQuery(nickname));
    return { profileUser };
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

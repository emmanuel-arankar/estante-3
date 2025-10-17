import { redirect, defer } from 'react-router-dom'; // # atualizado
import { toastErrorClickable } from '../../components/ui/toast';
import { queryClient } from '../../lib/queryClient';
import { getCurrentUser } from '../../services/auth';
import { userByNicknameQuery, userQuery } from '../users/user.queries';
import { PATHS } from '../../router/paths';

// # atualizado: Loader de perfil público agora usa defer
export const profileLoader = async ({ params }: any) => {
  const { nickname } = params;
  if (!nickname) return redirect(PATHS.HOME);

  try {
    // # atualizado: Não usamos 'await' aqui, apenas iniciamos a busca
    // e passamos a promessa para o 'defer'.
    const profilePromise = queryClient.ensureQueryData(userByNicknameQuery(nickname));
    return defer({ profileUser: profilePromise });
  } catch (error) {
    toastErrorClickable('Usuário não encontrado.');
    throw error;
  }
};

// # atualizado: Loader do perfil do usuário logado agora usa defer
export const meProfileLoader = async () => {
  const user = getCurrentUser();
  if (!user) return redirect(PATHS.LOGIN);
  const profilePromise = queryClient.ensureQueryData(userQuery(user.uid));
  return defer({ profileUser: profilePromise });
};

export const editProfileLoader = async () => {
  const user = getCurrentUser(); // # atualizado: Chamada síncrona, sem 'await'
  if (!user) return redirect(PATHS.LOGIN);
  return await queryClient.ensureQueryData(userQuery(user.uid));
};

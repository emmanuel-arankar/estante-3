import { redirect } from 'react-router-dom';
import { toastErrorClickable } from '@/components/ui/toast';
import { PATHS } from '@/router/paths';
import { getUserRoles } from '@/services/auth';

export const adminLoader = async () => {
  try {
    const roles = await getUserRoles();
    
    if (!roles?.admin) {
      // # atualizado: Usa a função toastErrorClickable existente
      toastErrorClickable('Você não tem permissão para acessar esta área.');
      return redirect(PATHS.HOME);
    }
    
    return null;
  } catch (error) {
    // # atualizado: Usa a função toastErrorClickable existente
    toastErrorClickable('Ocorreu um erro ao verificar suas permissões de acesso.');
    return redirect(PATHS.HOME);
  }
};
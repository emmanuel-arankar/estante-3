import { redirect } from 'react-router-dom';
import { toastErrorClickable } from '@/components/ui/toast';
import { PATHS } from '@/router/paths';
import { apiClient } from '@/services/api/apiClient';

export const curatorLoader = async () => {
  try {
    await apiClient('/curatorship/verify');
    return null;
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status;
    switch (status) {
      case 403:
        toastErrorClickable('Você não tem permissão para acessar esta área.');
        break;
      case 401:
        toastErrorClickable('Faça login para acessar o painel de curadoria.');
        break;
      default:
        toastErrorClickable('Ocorreu um erro ao verificar suas permissões de acesso.');
        break;
    }
    return redirect(PATHS.HOME);
  }
};

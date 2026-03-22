import { redirect } from 'react-router-dom';
import {
  toastSuccessClickable,
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { syncProfileAPI } from '@/services/api/friendshipsApi';
import { auth } from '@/services/firebase/firebase';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api/apiClient';
import { UserLocation } from '@estante/common-types';
import { trackEvent } from '@/lib/analytics';

export const editProfileAction = async ({ request }: any) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const user = auth.currentUser;

  if (!user) return redirect(PATHS.LOGIN);

  // 1. Preparar dados de data de nascimento
  let birthDate: Date | null = null;
  if (data.birthDay && data.birthMonth && data.birthYear) {
    birthDate = new Date(
      parseInt(data.birthYear as string),
      parseInt(data.birthMonth as string) - 1,
      parseInt(data.birthDay as string)
    );
  }

  // 2. Preparar localização
  let location: string | UserLocation = '';
  if (data.locationState && data.locationStateCode && data.locationCity) {
    location = {
      state: data.locationState as string,
      stateCode: data.locationStateCode as string,
      city: data.locationCity as string,
    };
  }

  const updatedFields = {
    displayName: data.displayName as string,
    nickname: data.nickname as string,
    bio: (data.bio as string) || '',
    location: location,
    website: (data.website as string) || '',
    birthDate: birthDate,
  };

  try {
    // 3. Persistir no backend (Aguardar reposta)
    await apiClient('/users/me', {
      method: 'PATCH',
      data: {
        ...updatedFields,
        birthDate: updatedFields.birthDate ? updatedFields.birthDate.toISOString() : null,
      },
    });

    // 4. Se chegou aqui, deu sucesso! Atualizar cache local
    queryClient.setQueryData(['users', user.uid], (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedFields };
    });

    // 5. Atualizar AuthStore imediatamente (para o Header/Avatar)
    const currentAuthUser = useAuthStore.getState().user;
    if (currentAuthUser) {
      useAuthStore.getState().setUser({
        ...currentAuthUser,
        displayName: updatedFields.displayName,
      } as any);
    }

    // 6. Sincronizar amizades para propagar mudanças de nome/nickname (em background)
    syncProfileAPI().catch(console.error);

    // 7. Mostrar feedback
    toastSuccessClickable('Perfil salvo com sucesso!');
    trackEvent('profile_updated');

    // 8. Redirecionar
    return redirect(PATHS.PROFILE_ME);
  } catch (error: any) {
    console.error('Erro na ação de perfil:', error);

    // Extrair mensagem de erro detalhada da API se existir
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro ao salvar perfil. Tente novamente.';

    toastErrorClickable(errorMessage);
    // Em caso de erro, forçamos um refetch invisível para limpar a sujeira otimista caso houvesse
    queryClient.invalidateQueries({ queryKey: ['users', user.uid] });

    return { error: errorMessage };
  }
};

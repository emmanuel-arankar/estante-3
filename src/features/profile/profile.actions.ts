import { redirect } from 'react-router-dom';
import {
  toastSuccessClickable,
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { syncProfileAPI } from '@/services/friendshipsApi';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/apiClient';
import { UserLocation } from '@estante/common-types';

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
    // 3. ATUALIZAÇÃO OTIMISTA: Atualizar cache local ANTES do banco
    queryClient.setQueryData(['users', user.uid], (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedFields };
    });

    // 4. Atualizar AuthStore imediatamente (para o Header/Avatar)
    const currentAuthUser = useAuthStore.getState().user;
    if (currentAuthUser) {
      useAuthStore.getState().setUser({
        ...currentAuthUser,
        displayName: updatedFields.displayName,
      } as any);
    }

    // 5. Mostrar feedback imediato
    toastSuccessClickable('Perfil salvo com sucesso!');

    // 6. Persistir no backend (Background)
    apiClient('/users/me', {
      method: 'PATCH',
      data: {
        ...updatedFields,
        birthDate: updatedFields.birthDate ? updatedFields.birthDate.toISOString() : null,
      },
    })
      .then(() => {
        // Sincronizar amizades para propagar mudanças de nome/nickname
        syncProfileAPI().catch(console.error);
      })
      .catch((error) => {
        console.error('Erro ao salvar perfil no backend:', error);
        // Rollback: invalidar cache para forçar refetch dos dados reais
        queryClient.invalidateQueries({ queryKey: ['users', user.uid] });
        toastErrorClickable('Erro ao sincronizar com o servidor. Recarregue.');
      });

    // 7. Redirecionar IMEDIATAMENTE
    return redirect(PATHS.PROFILE_ME);
  } catch (error) {
    console.error('Erro na ação de perfil:', error);
    toastErrorClickable('Erro ao processar as alterações.');
    return { error: 'Falha ao processar' };
  }
};
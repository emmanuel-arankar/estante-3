import { redirect } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import {
  toastSuccessClickable,
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { syncProfileAPI } from '@/services/friendshipsApi';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '@/stores/authStore';
import { UserLocation } from '@estante/common-types';

export const editProfileAction = async ({ request }: any) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const user = auth.currentUser;

  if (!user) return redirect(PATHS.LOGIN);

  // Preparar dados
  let birthDate = null;
  if (data.birthDay && data.birthMonth && data.birthYear) {
    birthDate = new Date(
      parseInt(data.birthYear as string),
      parseInt(data.birthMonth as string) - 1,
      parseInt(data.birthDay as string)
    );
  }

  // Preparar localização
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
    updatedAt: new Date(),
  };

  try {
    // 1. ATUALIZAÇÃO OTIMISTA: Atualizar cache local ANTES do banco
    // Isso faz a UI refletir instantaneamente
    queryClient.setQueryData(['users', user.uid], (oldData: any) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updatedFields };
    });

    // 2. Atualizar AuthStore imediatamente (para o Header)
    // Criamos um objeto que simula o user atualizado
    const currentAuthUser = useAuthStore.getState().user;
    if (currentAuthUser) {
      useAuthStore.getState().setUser({
        ...currentAuthUser,
        displayName: updatedFields.displayName,
      } as any);
    }

    // 3. Mostrar toast de sucesso AGORA (feedback imediato)
    toastSuccessClickable('Perfil salvo com sucesso!');

    // 4. Disparar operações de banco em PARALELO e SEM BLOQUEAR o redirect
    // Usamos Promise.all mas não esperamos - deixamos rodar em background
    const savePromises = [
      // Salvar no Firestore
      updateDoc(doc(db, 'users', user.uid), updatedFields),
      // Atualizar Firebase Auth (para displayName)
      updateProfile(user, { displayName: updatedFields.displayName }),
    ];

    // Executamos tudo em paralelo, mas NÃO esperamos
    Promise.all(savePromises)
      .then(() => {
        // Sincronização de amizades em background (não bloqueia nada)
        syncProfileAPI().catch(console.error);
      })
      .catch((error) => {
        console.error('Erro ao salvar perfil no backend:', error);
        // Rollback: invalidar cache para forçar refetch dos dados reais
        queryClient.invalidateQueries({ queryKey: ['users', user.uid] });
        toastErrorClickable('Erro ao salvar. Recarregue a página.');
      });

    // 5. Redirecionar IMEDIATAMENTE (não espera o banco)
    return redirect(PATHS.PROFILE_ME);
  } catch (error) {
    console.error('Erro:', error);
    toastErrorClickable('Erro ao salvar o perfil.');
    return { error: 'Falha ao salvar' };
  }
};
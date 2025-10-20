import { redirect } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  toastSuccessClickable,
  toastErrorClickable,
} from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { PATHS } from '@/router/paths';
import { syncDenormalizedUserData } from '@/services/denormalizedFriendships';
import { auth, db } from '@/services/firebase';

export const editProfileAction = async ({ request }: any) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  const user = auth.currentUser;

  if (!user) return redirect(PATHS.LOGIN);

  try {
    let birthDate = null;
    if (data.birthDay && data.birthMonth && data.birthYear) {
      birthDate = new Date(
        parseInt(data.birthYear as string),
        parseInt(data.birthMonth as string) - 1,
        parseInt(data.birthDay as string)
      );
    }

    await updateDoc(doc(db, 'users', user.uid), {
      displayName: data.displayName,
      nickname: data.nickname,
      bio: data.bio || '',
      location: data.location || '',
      website: data.website || '',
      birthDate: birthDate,
      updatedAt: new Date(),
    });

    await syncDenormalizedUserData(user.uid);
    await queryClient.refetchQueries({ queryKey: ['users', user.uid] });
    
    toastSuccessClickable('Perfil salvo com sucesso!');
    return redirect(PATHS.PROFILE_ME); 
  } catch (error) {
    toastErrorClickable('Erro ao salvar o perfil.');
    return { error: 'Falha ao salvar' };
  }
};
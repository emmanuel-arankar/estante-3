import { redirect } from 'react-router-dom';
import { getUserNotifications } from '../../services/firestore';
import { queryClient } from '../../lib/queryClient';
import { getCurrentUser } from '../../services/auth';
import { PATHS } from '../../router/paths';

const notificationsQuery = (userId: string) => ({
    queryKey: ['notifications', userId],
    queryFn: () => getUserNotifications(userId),
});

export const notificationsLoader = async () => {
  const user = getCurrentUser(); // # atualizado: Chamada síncrona, sem 'await'
  if (!user) return redirect(PATHS.LOGIN);
  return await queryClient.ensureQueryData(notificationsQuery(user.uid));
};

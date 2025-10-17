import { getPendingRequestCount } from '@/services/firestore';
import { awaitAuthReady, getCurrentUser } from '@/services/auth';
import { queryClient } from '@/lib/queryClient';
import { userQuery } from '@/features/users/user.queries';
import { useAuthStore } from '@/stores/authStore';


export const layoutLoader = async () => {
  await awaitAuthReady();
  const user = getCurrentUser();

  if (!user) {
    return { userProfile: null, initialFriendRequests: 0 };
  }

  try {
    const [userProfile, initialFriendRequests] = await Promise.all([
      queryClient.ensureQueryData(userQuery(user.uid)),
      getPendingRequestCount(user.uid)
    ]);

    useAuthStore.getState().setIsLoadingProfile(false);
    return { userProfile, initialFriendRequests };
  } catch (error) {
    console.error("Layout loader error:", error);
    useAuthStore.getState().setIsLoadingProfile(false);
    return { userProfile: null, initialFriendRequests: 0 };
  }
};

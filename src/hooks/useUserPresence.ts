import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  setUserOnline,
  setUserOffline,
  subscribeToUserStatus,
  subscribeToConnection,
  Unsubscribe
} from '@/services/firebase/realtime';

// --- useUserPresence (Ouve o status de outro usuário) ---
interface PresenceStatus {
  online: boolean;
  lastSeen: number | null;
}

export const useUserPresence = (userId: string | null | undefined): PresenceStatus => {
  const [presence, setPresence] = useState<PresenceStatus>({ online: false, lastSeen: null });

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToUserStatus(userId, (isOnline, lastSeen) => {
      setPresence((prev) => {
        const lastSeenTime = lastSeen ? lastSeen.getTime() : null;
        if (prev.online === isOnline && prev.lastSeen === lastSeenTime) return prev;
        return { online: isOnline, lastSeen: lastSeenTime };
      });
    });

    return () => unsubscribe();
  }, [userId]);

  return presence;
};

// --- useManageMyPresence (Monitora e envia meu status) ---
/**
 * Hook "Sticky" (Aderente): Só marca como online.
 * O offline é tratado pelo onDisconnect (servidor) ou explicitamente no logout.
 */
export const useManageMyPresence = () => {
  const { user } = useAuth();
  const myUidRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeConnected: Unsubscribe | null = null;

    if (user) {
      const myUid = user.uid;
      myUidRef.current = myUid;

      unsubscribeConnected = subscribeToConnection((isConnected) => {
        if (isConnected === true) {
          setUserOnline(myUid)
            .then(() => {
              console.log(`✅ [Presença] Sticky-Status ONLINE via API: ${myUid}`);
            })
            .catch((error) => {
              console.error(`❌ [Presença] Erro ao sincronizar status via API:`, error);
            });
        }
      });

      return () => {
        if (unsubscribeConnected) unsubscribeConnected();
        // Opcional: Marcar como offline ao desmontar, mas o onDisconnect no servidor é mais confiável para crashes/fechamento de aba
        if (myUidRef.current) {
          setUserOffline(myUidRef.current).catch(() => { });
        }
      };
    }
  }, [user]);
};

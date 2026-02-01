import { useState, useEffect, useRef } from 'react';
import { ref, onValue, serverTimestamp, set, onDisconnect, Unsubscribe } from 'firebase/database';
import { database } from '../services/firebase';
import { useAuth } from './useAuth';

// --- useUserPresence (Ouve o status de outro usuário) ---
interface PresenceStatus {
  online: boolean;
  lastSeen: number | null;
}

export const useUserPresence = (userId: string | null | undefined): PresenceStatus => {
  const [presence, setPresence] = useState<PresenceStatus>({ online: false, lastSeen: null });

  useEffect(() => {
    if (!userId || !database) return;

    const userStatusRef = ref(database, `/status/${userId}`);

    const unsubscribe = onValue(userStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists()) {
        const isOnline = data.online === true;
        setPresence((prev) => {
          if (prev.online === isOnline && prev.lastSeen === data.lastSeen) return prev;
          return { online: isOnline, lastSeen: data.lastSeen || null };
        });
      }
    }, (error) => {
      console.error(`[useUserPresence] Erro no listener para ${userId}:`, error);
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

    if (user && database) {
      const myUid = user.uid;
      myUidRef.current = myUid;
      const userStatusRef = ref(database, `/status/${myUid}`);
      const connectedRef = ref(database, '.info/connected');

      const isOnlineForDatabase = {
        online: true,
        lastSeen: serverTimestamp(),
      };

      const isOfflineForDatabase = {
        online: false,
        lastSeen: serverTimestamp(),
      };

      unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        const isConnected = snapshot.val();

        if (isConnected === true) {
          onDisconnect(userStatusRef).set(isOfflineForDatabase)
            .then(() => {
              return set(userStatusRef, isOnlineForDatabase);
            })
            .then(() => {
              console.log(`✅ [Presença] Sticky-Status ONLINE: ${myUid}`);
            })
            .catch((error) => {
              console.error(`❌ [Presença] Erro ao sincronizar status:`, error);
            });
        }
      });

      return () => {
        if (unsubscribeConnected) unsubscribeConnected();
      };
    }
    // IMPORTANTE: Não estamos forçando offline no deslogar via hook para evitar flickers.
    // O offline é forçado pelo serviço de logout ou timeout do servidor.
  }, [user]);
};

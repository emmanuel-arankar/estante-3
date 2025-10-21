import { useState, useEffect, useRef } from 'react';
import { ref, onValue, off, serverTimestamp, set, onDisconnect, goOnline, goOffline, DatabaseReference, Unsubscribe } from 'firebase/database'; // Importar Unsubscribe
import { database } from '../services/firebase';
import { useAuth } from './useAuth';

// --- useUserPresence (Mantém a versão anterior com logs) ---
interface PresenceStatus {
  online: boolean;
  lastSeen: number | null;
}
export const useUserPresence = (userId: string | null | undefined): PresenceStatus => {
    // ... (manter a versão anterior com logs para continuar depurando a leitura se necessário)
    // Código omitido para brevidade - use a versão com logs da resposta anterior aqui
     const [presence, setPresence] = useState<PresenceStatus>({ online: false, lastSeen: null });
     // console.log(`[useUserPresence] Hook initialized/updated for userId: ${userId}`);

      useEffect(() => {
        // console.log(`[useUserPresence] useEffect executado para userId: ${userId}`);
        let userStatusRef: DatabaseReference | null = null; // Mover para dentro para limpeza correta
        let unsubscribe: Unsubscribe | null = null; // Para guardar a função de unsubscribe do onValue
        let timeoutId: NodeJS.Timeout | null = null;
        let listenerCalled = false;
        let initialDataLoaded = false;

        if (!userId || !database) {
            if (!userId) console.log(`[useUserPresence] No userId, resetting status for ${userId}`);
            if (!database) console.log(`[useUserPresence] Database not available, resetting status for ${userId}`);
            setPresence({ online: false, lastSeen: null });
          return;
        }

        userStatusRef = ref(database, `/status/${userId}`);
        // console.log(`[useUserPresence] Setting up listener for path: ${userStatusRef.toString()}`);

        const handleValueChange = (snapshot: any) => {
            listenerCalled = true;
            const data = snapshot.val();
            // console.log(`[useUserPresence] Data received for ${userId}:`, data);
            if (snapshot.exists()) {
                const newPresence = {
                    online: data.online === true,
                    lastSeen: data.lastSeen || null,
                };
                // console.log(`[useUserPresence] Updating state for ${userId} to:`, newPresence);
                setPresence(newPresence);
                initialDataLoaded = true;
            } else {
                // console.log(`[useUserPresence] Snapshot doesn't exist for ${userId}, setting offline.`);
                setPresence({ online: false, lastSeen: null });
                initialDataLoaded = true;
            }
        };

        const listenerError = (error: Error) => {
          console.error(`[useUserPresence] Listener error for ${userId}:`, error);
        };

        // Guarda a função de unsubscribe retornada por onValue
        unsubscribe = onValue(userStatusRef, handleValueChange, listenerError);

        timeoutId = setTimeout(() => {
          if (!listenerCalled) {
            console.warn(`[useUserPresence] Listener for ${userId} did not receive initial data after 5s. Check DB rules/connection.`);
          } else if (!initialDataLoaded) {
              console.warn(`[useUserPresence] Listener for ${userId} called but initial data flag not set after 5s.`);
          }
        }, 5000);

        // Função de limpeza
        return () => {
          // console.log(`[useUserPresence] Cleaning up listener for path: ${userStatusRef?.toString()}`);
          if(timeoutId) clearTimeout(timeoutId);
          // Usa a função de unsubscribe guardada, se existir, e a ref
          if (unsubscribe && userStatusRef) {
              off(userStatusRef, 'value', unsubscribe); // Usa a função unsubscribe correta
          } else if (userStatusRef) {
              // Fallback caso unsubscribe não tenha sido guardado (menos ideal)
              off(userStatusRef);
          }
        };

      }, [userId]);

      return presence;
};


// --- useManageMyPresence (Nova Versão Simplificada) ---
export const useManageMyPresence = () => {
  const { user } = useAuth();
  const myUidRef = useRef<string | null>(null); // Guarda o UID para a limpeza

  // console.log(`[useManageMyPresence] Hook renderizado. User state: ${user ? user.uid : 'null'}`);

  useEffect(() => {
    let connectedRefListener: Unsubscribe | null = null; // Guarda o unsubscribe do .info/connected

    if (user && database) {
      const myUid = user.uid;
      myUidRef.current = myUid; // Guarda o UID atual
      const userStatusRef = ref(database, `/status/${myUid}`);
      // console.log(`[useManageMyPresence] useEffect setup for user: ${myUid}`);

      const isOnlineForDatabase = {
        online: true,
        lastSeen: serverTimestamp(),
      };
      const isOfflineForDatabase = {
        online: false,
        lastSeen: serverTimestamp(),
      };

      const connectedRef = ref(database, '.info/connected');

      // Tenta forçar a conexão online (pode ajudar em alguns casos)
      // console.log(`[useManageMyPresence] Calling goOnline() for ${myUid}`);
      goOnline(database);

      connectedRefListener = onValue(connectedRef, (snapshot) => {
        const isConnected = snapshot.val();
        // console.log(`[useManageMyPresence] .info/connected for ${myUid}. Value: ${isConnected}`);

        if (isConnected === true) {
          // Configura onDisconnect para definir offline quando desconectar
          onDisconnect(userStatusRef).set(isOfflineForDatabase)
            .then(() => {
              // console.log(`[useManageMyPresence] onDisconnect set for ${myUid}. Now writing online status.`);
              // SOMENTE APÓS onDisconnect ser configurado, define o status atual como online
              return set(userStatusRef, isOnlineForDatabase);
            })
            .then(() => {
                // console.log(`[useManageMyPresence] Successfully set online status for ${myUid}`);
            })
            .catch((error) => {
              console.error(`[useManageMyPresence] Error setting presence for ${myUid}:`, error);
            });
        }
        // Não faz nada se isConnected for false, onDisconnect cuidará disso.
      }, (error) => {
          console.error(`[useManageMyPresence] Error on .info/connected listener for ${myUid}:`, error);
      });

      // Função de limpeza principal
      return () => {
        // console.log(`[useManageMyPresence] Cleaning up useEffect for user: ${myUidRef.current}`);
        if (connectedRefListener) {
          // console.log(`[useManageMyPresence] Removing .info/connected listener.`);
          off(connectedRef, 'value', connectedRefListener);
          connectedRefListener = null;
        }

        // IMPORTANTE: NÃO cancele o onDisconnect aqui. Ele precisa permanecer ativo
        // para funcionar se a aba for fechada ou a rede cair após o componente desmontar.

        // Opcional: Tentar forçar desconexão (se sair da aplicação)
        // console.log(`[useManageMyPresence] Calling goOffline()`);
        // goOffline(database);

        // NÃO defina offline aqui manualmente.
        myUidRef.current = null; // Limpa a ref do UID
      };

    } else {
      // Usuário deslogou ou database não está pronto
      // console.log(`[useManageMyPresence] useEffect skipped (no user/db).`);
      // Limpeza caso o usuário deslogue
       const uidToClean = myUidRef.current;
       if (uidToClean && database) {
           const userStatusRef = ref(database, `/status/${uidToClean}`);
           const isOfflineForDatabase = { online: false, lastSeen: serverTimestamp() };
           console.log(`[useManageMyPresence] User logged out. Attempting to set offline status for ${uidToClean}.`);
           // Tenta definir como offline explicitamente no logout
           set(userStatusRef, isOfflineForDatabase).catch(err => console.error(`Error setting offline on logout for ${uidToClean}`, err));
           // Cancela qualquer onDisconnect pendente para este usuário, pois ele deslogou
           onDisconnect(userStatusRef).cancel();
           myUidRef.current = null; // Limpa
       }
      return; // Sem função de limpeza específica quando não há usuário
    }
  }, [user]); // Dependência principal é o usuário
};
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/services/firebase';

interface PresenceStatus {
  online: boolean;
  lastSeen: number | null;
}

export const useUserPresence = (userId: string | null | undefined): PresenceStatus => {
  const [presence, setPresence] = useState<PresenceStatus>({ 
    online: false, 
    lastSeen: null 
  });

  useEffect(() => {
    if (!userId || !database) {
      setPresence({ online: false, lastSeen: null }); // Reset se não houver userId
      return;
    }

    // # atualizado: Caminho para o status no RTDB
    const userStatusRef = ref(database, `/status/${userId}`);

    const handleValueChange = (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setPresence({
          online: data.online === true, // Garante que é boolean
          lastSeen: data.lastSeen || null,
        });
      } else {
        setPresence({ 
          online: false, 
          lastSeen: null 
        }); // Usuário nunca esteve online ou dados limpos
      }
    };

    onValue(userStatusRef, handleValueChange);

    // Limpeza ao desmontar ou quando userId mudar
    return () => {
      // # atualizado: Garantir que a ref existe antes de chamar 'off'
      if (userStatusRef) {
        off(userStatusRef, 'value', handleValueChange);
      }
    };

  }, [userId]); // Re-executa se o userId mudar

  return presence;
};

// Hook para gerenciar o status do USUÁRIO LOGADO
import { useAuth } from '@/hooks/useAuth';
import { ref as dbRef, set, onDisconnect, serverTimestamp, goOnline, goOffline } from 'firebase/database';

export const useManageMyPresence = () => {
  const { user } = useAuth(); // Pega o usuário logado

  useEffect(() => {
    if (user && database) {
      const myUid = user.uid;
      const userStatusRef = dbRef(database, `/status/${myUid}`);

      // Dados a serem salvos no RTDB
      const isOnlineForDatabase = {
        online: true,
        lastSeen: serverTimestamp(), // Firebase insere o timestamp do servidor
      };
      const isOfflineForDatabase = {
        online: false,
        lastSeen: serverTimestamp(),
      };

      // Listener de conexão do RTDB
      const connectedRef = dbRef(database, '.info/connected');
      onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
          // Conectado: define o status online
          set(userStatusRef, isOnlineForDatabase);

          // Define a ação onDisconnect para marcar como offline
          onDisconnect(userStatusRef).set(isOfflineForDatabase).catch((err) => {
            console.error("Erro ao configurar onDisconnect:", err);
          });
        }
      });
      
      // Opcional: Forçar a conexão/desconexão ao montar/desmontar
      // goOnline(database); // Indica intenção de conectar
      // return () => {
      //   set(userStatusRef, isOfflineForDatabase); // Tenta marcar como offline imediatamente
      //   goOffline(database); // Indica intenção de desconectar
      // }
      
    }
    // Não precisa de limpeza complexa aqui, onDisconnect cuida disso
  }, [user]); // Re-executa se o usuário mudar (login/logout)
};
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import Fuse from 'fuse.js';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { FriendshipWithUser, User } from '@/models';
import { acceptFriendRequest, rejectFriendRequest, removeFriend } from '../services/firestore';
import { toastSuccessClickable, toastErrorClickable } from '@/components/ui/toast';

enableMapSet();

interface OptimisticAction {
  type: 'accept' | 'reject' | 'remove';
  friendshipId: string;
}

interface FriendsState {
  searchQuery: string;
  sortField: 'name' | 'nickname' | 'friendshipDate';
  sortDirection: 'asc' | 'desc';
  actionLoading: Set<string>;
  globalLoading: boolean;
  optimisticActions: OptimisticAction[];
  fuse: {
    friends: Fuse<FriendshipWithUser>;
    requests: Fuse<FriendshipWithUser>;
    sentRequests: Fuse<FriendshipWithUser>;
  };
  rawData: {
    friends: FriendshipWithUser[];
    requests: FriendshipWithUser[];
    sentRequests: FriendshipWithUser[];
  };
  setSearchQuery: (query: string) => void;
  setSortField: (field: FriendsState['sortField']) => void;
  toggleSortDirection: () => void;
  startAction: (id: string) => void;
  endAction: (id: string) => void;
  updateData: (type: keyof FriendsState['rawData'], data: FriendshipWithUser[]) => void;
  handleAcceptRequest: (userId: string, friendId: string, friendshipId: string) => Promise<void>;
  handleRejectRequest: (userId: string, friendId: string, friendshipId: string) => Promise<void>;
  handleRemoveFriend: (userId: string, friendId: string) => Promise<void>;
  subscribeToRealtimeUpdates: (userId: string) => () => void;
}

const fuseOptions = {
  keys: [
    { name: 'friend.displayName', weight: 0.6 },
    { name: 'friend.nickname', weight: 0.4 },
    { name: 'friend.email', weight: 0.2 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
  useExtendedSearch: true,
};

const processFriendshipData = (
  friendships: any[], 
  users: User[], 
  currentUserId: string,
  // # atualizado: Adicionado um parâmetro para saber qual campo usar
  otherUserField: 'friendId' | 'requestedBy' 
): FriendshipWithUser[] => {
  return friendships.map(friendship => {
    // # atualizado: Lógica simplificada para encontrar o ID do outro usuário
    const otherUserId = friendship[otherUserField];

    const friend = users.find(u => u.id === otherUserId);

    return {
      ...friendship,
      friend: friend || {
        id: otherUserId,
        displayName: 'Usuário desconhecido',
        nickname: 'desconhecido', // # atualizado: Evitar nickname vazio
        photoURL: null,
      },
    };
  });
};

export const useFriendsStore = create<FriendsState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        searchQuery: '',
        sortField: 'friendshipDate',
        sortDirection: 'desc',
        actionLoading: new Set<string>(),
        globalLoading: false,
        optimisticActions: [],
        fuse: {
          friends: new Fuse([], fuseOptions),
          requests: new Fuse([], fuseOptions),
          sentRequests: new Fuse([], fuseOptions),
        },
        rawData: {
          friends: [],
          requests: [],
          sentRequests: [],
        },

        setSearchQuery: (query) => set(state => {
          if (state.searchQuery !== query) {
            state.searchQuery = query;
          }
        }),
        setSortField: (field) => set(state => {
          // Reset direction only when changing field
          if (state.sortField !== field) {
            state.sortDirection = 'desc';
          }
          state.sortField = field;
        }),
        toggleSortDirection: () => set(state => ({
          sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc'
        })),
        startAction: (id) => set(state => {
          const newSet = new Set(state.actionLoading);
          newSet.add(id);
          state.actionLoading = newSet;
        }),
        endAction: (id) => set(state => {
          const newSet = new Set(state.actionLoading);
          newSet.delete(id);
          state.actionLoading = newSet;
        }),
        updateData: (type, data) => set(state => {
          const safeData = data || [];
          state.rawData[type] = safeData;
          state.fuse[type] = new Fuse(safeData, fuseOptions);
        }),

        handleAcceptRequest: async (userId, friendId, friendshipId) => {
          toastSuccessClickable('Processando solicitação...', { id: friendshipId });
          get().startAction(friendshipId);
        
          set(state => {
            const acceptedRequest = state.rawData.requests.find(r => r.id === friendshipId);
            if (!acceptedRequest) return;
        
            // remove da aba de requests
            state.rawData.requests = state.rawData.requests.filter(r => r.id !== friendshipId);
            state.fuse.requests = new Fuse(state.rawData.requests, fuseOptions);
        
            // adiciona imediatamente na aba de amigos
            const newFriend: FriendshipWithUser = {
              ...acceptedRequest,
              status: 'accepted',
              friendshipDate: new Date(),
            };
            state.rawData.friends = [newFriend, ...state.rawData.friends];
            state.fuse.friends = new Fuse(state.rawData.friends, fuseOptions);
        
            state.optimisticActions.push({ type: 'accept', friendshipId });
          });
        
          try {
            await acceptFriendRequest(userId, friendId);
            toastSuccessClickable('Solicitação aceita!', { id: friendshipId });
          } catch (err) {
            console.error(err);
            toastErrorClickable('Erro ao aceitar solicitação', { id: friendshipId });
        
            // rollback completo
            set(state => {
              state.optimisticActions = state.optimisticActions.filter(a => !(a.type === 'accept' && a.friendshipId === friendshipId));
              // força reload no próximo snapshot/query
              state.rawData.requests = [];
              state.rawData.friends = [];
              state.fuse.requests = new Fuse([], fuseOptions);
              state.fuse.friends = new Fuse([], fuseOptions);
            });
          } finally {
            get().endAction(friendshipId);
          }
        },
        
        handleRejectRequest: async (userId, friendId, friendshipId) => {
          toastSuccessClickable('Processando recusa...', { id: friendshipId });
          get().startAction(friendshipId);
        
          set(state => {
            state.optimisticActions.push({ type: 'reject', friendshipId });
            state.rawData.requests = state.rawData.requests.filter(r => r.id !== friendshipId);
            state.fuse.requests = new Fuse(state.rawData.requests, fuseOptions);
          });
        
          try {
            await rejectFriendRequest(userId, friendId);
            toastSuccessClickable('Solicitação recusada', { id: friendshipId });
          } catch (err) {
            console.error(err);
            toastErrorClickable('Erro ao recusar solicitação', { id: friendshipId });
            set(state => {
              state.optimisticActions = state.optimisticActions.filter(a => a.friendshipId !== friendshipId);
              state.rawData.requests = [];
              state.fuse.requests = new Fuse([], fuseOptions);
            });
          } finally {
            get().endAction(friendshipId);
          }
        },

        handleRemoveFriend: async (userId, friendId) => {
          const friendshipId = `${userId}_${friendId}`;
          
          // Immediate feedback
          toastSuccessClickable('Removendo amigo...', { id: friendshipId });
          
          set(state => {
            state.optimisticActions.push({ type: 'remove', friendshipId });
            state.rawData.friends = state.rawData.friends.filter(f => f.id !== friendshipId);
            state.fuse.friends = new Fuse(state.rawData.friends, fuseOptions);
          });

          try {
            await removeFriend(userId, friendId);
            toastSuccessClickable('Amigo removido', { id: friendshipId });
          } catch (err) {
            console.error(err);
            toastErrorClickable('Erro ao remover amigo', { id: friendshipId });
            set(state => {
              state.optimisticActions = state.optimisticActions.filter(a => a.friendshipId !== friendshipId);
              // Trigger reload
              state.rawData.friends = [];
            });
          }
        },

        subscribeToRealtimeUpdates: (userId: string) => {
          console.log("userId atual:", userId)

          const set = useFriendsStore.setState;
        
          // array local de unsubscribes
          const unsubscribeFns: (() => void)[] = [];
        
          const updateState = (
            type: 'friends' | 'requests' | 'sentRequests',
            data: any[]
          ) => {
            set(draft => {
              // Atualiza apenas a propriedade específica mantendo as outras
              draft.rawData[type] = data;
              draft.fuse[type] = new Fuse(data, fuseOptions);
            });
          
            console.log(`✅ estado atualizado [${type}]`, get());
          };

          const processSnapshot = (
            type: 'friends' | 'requests' | 'sentRequests',
            snapshot: QuerySnapshot<DocumentData>
          ) => {
            const friendships = snapshot.docs.map((d: any) => ({
              id: d.id,
              ...d.data(),
            })) as any[];
          
            // # atualizado: Determina qual campo de ID usar
            const otherUserField = type === 'requests' ? 'requestedBy' : 'friendId';

            const friendIds = friendships
              .map(f => f[otherUserField])
              .filter(Boolean);
          
            if (friendIds.length === 0) {
              updateState(type, []);
              return;
            }
          
            const unsubUsers = onSnapshot(
              query(collection(db, 'users'), where('id', 'in', friendIds)),
              usersSnap => {
                const users = usersSnap.docs.map(d => ({
                  id: d.id,
                  ...d.data(),
                })) as User[];
          
                // # atualizado: Passa o campo correto para a função
                const processedData = processFriendshipData(
                  friendships,
                  users,
                  userId,
                  otherUserField
                );
          
                updateState(type, processedData);
              }
            );
          
            unsubscribeFns.push(unsubUsers);
          };
        
          // Para friends (amigos aceitos)
          const unsubscribeFriends = onSnapshot(
            query(
              collection(db, 'friendships'),
              where('userId', '==', userId),
              where('status', '==', 'accepted')
            ),
            (snapshot) => processSnapshot('friends', snapshot)
          );
          
          // Para requests (solicitações recebidas)
          const unsubscribeRequests = onSnapshot(
            query(
              collection(db, 'friendships'),
              where('userId', '==', userId), // O documento pertence ao usuário atual
              where('status', '==', 'pending'),
              where('requestedBy', '!=', userId) // Mas não foi o usuário atual quem enviou
            ),
            (snapshot) => {
              console.log("📡 snapshot requests size:", snapshot.size);
              snapshot.docs.forEach(doc => {
                console.log("📄 request doc:", doc.id, doc.data());
              });
              processSnapshot('requests', snapshot);
            },
            (error) => {
              console.error("🔥 Firestore error [requests]:", error);
            }
          );
          
          // Para sentRequests (solicitações enviadas)
          const unsubscribeSentRequests = onSnapshot(
            query(
              collection(db, 'friendships'),
              where('userId', '==', userId),
              where('status', '==', 'pending'),
              where('requestedBy', '==', userId) // Somente as que o usuário atual enviou
            ),
            (snapshot) => processSnapshot('sentRequests', snapshot)
          );
        
          unsubscribeFns.push(unsubscribeFriends, unsubscribeRequests, unsubscribeSentRequests);
        
          // retorno do unsubscribe
          return () => {
            unsubscribeFns.forEach(unsub => unsub());
          };
        }
      })),
      {
        name: 'friends-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          searchQuery: state.searchQuery,
          sortField: state.sortField,
          sortDirection: state.sortDirection,
        }),
      }
    )
  )
);

// Hook React Query
import React from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getUserFriendsPaginated, getFriendRequests, getSentFriendRequests } from '@/services/firestore';

export const useFriendsData = () => {
  const { user } = useAuth();
  const store = useFriendsStore();

  React.useEffect(() => {
    if (!user?.uid) return;
    
    // Substitua setImmediate por setTimeout com 0
    const timer = setTimeout(() => {
      store.updateData('friends', []);
      store.updateData('requests', []);
      store.updateData('sentRequests', []);
    }, 0);
    
    const unsubscribe = store.subscribeToRealtimeUpdates(user.uid);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      store.updateData('friends', []);
      store.updateData('requests', []);
      store.updateData('sentRequests', []);
    };
  }, [user?.uid]);

  const friendsQuery = useInfiniteQuery({
    queryKey: ['friends', user?.uid ?? ''],
    queryFn: async ({ pageParam }) => {
      try {
        if (!user?.uid) return { friends: [], hasMore: false, lastDoc: null };
        const result = await getUserFriendsPaginated(user.uid, 30, pageParam);
        
        // Atualiza o store com os dados frescos
        store.updateData('friends', result.friends);
        return result;
      } catch (error) {
        console.error('Error fetching friends:', error);
        return { friends: [], hasMore: false, lastDoc: null };
      }
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    initialPageParam: undefined,
  });

  const requestsQuery = useQuery({
    queryKey: ['friendRequests', user?.uid ?? ''],
    queryFn: async () => {
      if (!user?.uid) return [];
      return getFriendRequests(user.uid);
    },
  });

  const sentRequestsQuery = useQuery({
    queryKey: ['sentRequests', user?.uid ?? ''],
    queryFn: async () => {
      if (!user?.uid) return [];
      return getSentFriendRequests(user.uid);
    },
  });

  const isLoading = friendsQuery.isLoading || requestsQuery.isLoading || sentRequestsQuery.isLoading;

  return {
    store,
    queries: {
      friends: friendsQuery,
      requests: requestsQuery,
      sentRequests: sentRequestsQuery,
    },
    isLoading,
  };
};
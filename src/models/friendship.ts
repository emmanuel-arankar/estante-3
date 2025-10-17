// ==================== MODELOS DENORMALIZADOS ====================
export type SortOption = 'default' | 'name' | 'nickname' | 'friendshipDate';
export type SortDirection = 'asc' | 'desc';

export interface DenormalizedUser {
  id: string;
  displayName: string;
  nickname: string;
  photoURL?: string;
  email: string;
  bio?: string;
  location?: string;
  joinedAt: Date;
  lastActive?: Date;
}

export interface DenormalizedFriendship {
  id: string;
  userId: string;           // ID do usuário "dono" do documento
  friendId: string;         // ID do amigo
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;      // Quem iniciou a solicitação
  friendshipDate?: Date;    // Quando foi aceita
  createdAt: Date;
  updatedAt: Date;
  
  // ✅ DADOS DENORMALIZADOS DO AMIGO
  friend: DenormalizedUser; // Todos os dados necessários do amigo
}

export interface FriendshipStats {
  totalFriends: number;
  pendingRequests: number;
  sentRequests: number;
}

// Tipos para hooks React
export interface UseFriendsResult {
  friends: DenormalizedFriendship[];
  allFriends: DenormalizedFriendship[];
  requests: DenormalizedFriendship[];
  sentRequests: DenormalizedFriendship[];
  stats: FriendshipStats;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMoreFriends: boolean;
  
  // Controles de busca e ordenação
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortField: SortOption;
  setSortField: (field: SortOption) => void;
  sortDirection: SortDirection;
  setSortDirection: (direction: SortDirection) => void;
  
  // Ações de carregamento
  loadAllFriends: (refresh?: boolean) => Promise<void>;
  loadMoreFriends: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface FriendshipActions {
  sendFriendRequest: (targetUserId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  cancelSentRequest: (friendshipId: string) => Promise<void>;
  cancelAllSentRequests: () => Promise<void>;
}
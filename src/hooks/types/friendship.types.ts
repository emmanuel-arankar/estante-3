import {
  DenormalizedFriendship,
  FriendshipStats,
} from '@estante/common-types';

export type SortOption = 'default' | 'name' | 'nickname' | 'friendshipDate';
export type SortDirection = 'asc' | 'desc';

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
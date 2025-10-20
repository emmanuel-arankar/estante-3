import { User } from ".";

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  requestedBy: string;
  friendshipDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendshipWithUser extends Friendship {
  friend: User;          // Dados completos do amigo (para joins)
}

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
  userId: string;           // Código do proprietário do documento
  friendId: string;         // Código do amigo
  status: FriendshipStatus; 
  requestedBy: string;      // Quem fez a solicitação de amizade
  friendshipDate?: Date;    // Quando foi aceita a amizade
  createdAt: Date;
  updatedAt: Date;
  
  // Dados denormalizados do amigo
  friend: DenormalizedUser;
}

export interface FriendshipStats {
  totalFriends: number;
  pendingRequests: number;
  sentRequests: number;
}
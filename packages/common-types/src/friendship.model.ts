import { User } from ".";

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
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
  userId: string;           // ID do usuário "dono" do documento
  friendId: string;         // ID do amigo
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;      // Quem iniciou a solicitação
  friendshipDate?: Date;    // Quando foi aceita
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
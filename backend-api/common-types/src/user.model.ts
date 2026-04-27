export type UserRole = 'user' | 'librarian' | 'manager' | 'assistant' | 'admin'

export interface UserLocation {
  state: string;      // Nome do estado (ex: "São Paulo")
  stateCode: string;  // Código do estado (ex: "SP")
  city: string;       // Nome da cidade (ex: "São Paulo")
}

export interface UserStats {
  // Relacionamentos
  followers: number;
  following: number;
  friendsCount: number;
  pendingRequestsCount: number;

  // Leitura
  booksRead: number;
  currentlyReading: number;
  wantToRead?: number;

  // Avaliações
  reviewsCount?: number;
  ratingsCount?: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  photoURL?: string;
  role?: UserRole;
  bio?: string;
  location?: string | UserLocation;  // Suporta string (legado) ou objeto estruturado
  website?: string;
  birthDate?: Date;
  joinedAt: Date;
  stats?: UserStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAvatar {
  id: string;
  userId: string;
  originalUrl: string;
  croppedUrl: string;
  isPublic: boolean;
  cropData: {
    x: number;
    y: number;
    zoom: number;
    croppedArea: Record<string, unknown>;
  };
  uploadedAt: Date;
  isCurrent: boolean;
  likes: string[];
  comments: Comment[];
}
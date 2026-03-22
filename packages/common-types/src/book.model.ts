// =============================================================================
// SISTEMA DE LIVROS — MODELOS DE DADOS
// =============================================================================

// =============================================================================
// TIPOS AUXILIARES
// =============================================================================

export type UserBookStatus = 'reading' | 'completed' | 'want-to-read' | 'abandoned' | 'on-hold';
export type AgeRating = 'L' | '10' | '12' | '14' | '16' | '18';
export type PersonGender = 'male' | 'female' | 'non-binary' | 'other' | 'unknown';
export type ShelfViewMode = 'list' | 'grid' | 'spine';

export type ContributorRole =
  | 'author' | 'co-author' | 'translator' | 'illustrator'
  | 'cover-artist' | 'editor' | 'proofreader' | 'preface'
  | 'postface' | 'epilogue' | 'narrator' | 'revisor';

export type SuggestionType = 'work' | 'edition' | 'person' | 'group'
  | 'publisher' | 'series' | 'genre' | 'format' | 'correction';

export interface EntityReference {
  id: string;
  name: string;
}

export type AlternateNameType = 'native' | 'romanized' | 'phonetic'
  | 'translation' | 'alias' | 'pseudonym' | 'birthname'
  | 'legal' | 'posthumous' | 'abbreviation' | 'other';

export interface AlternateName {
  value: string;
  type?: AlternateNameType | string;
  language?: string;     // Ex: "pt-BR", "ja", "en"
  script?: string;       // Ex: "Latn", "Cyrl", "Hani"
  country?: string;      // Ex: "BR", "JP", "US"
  description?: string;  // Contexto livre opcional
}

// =============================================================================
// OBRA (conceito abstrato)
// =============================================================================

export interface Work {
  id: string;
  title: string;
  subtitle?: string;
  originalTitle?: string;
  alternateNames?: AlternateName[];
  originalLanguage?: string;
  originalPublicationDate?: string;
  description?: string;
  coverUrl?: string;
  ageRating?: AgeRating;
  userRating?: number;

  primaryAuthors: {
    id: string;
    name: string;
    type: 'person' | 'group';
  }[];

  // Taxonomia Profunda
  genres: EntityReference[];
  themes: EntityReference[];
  locations: EntityReference[];

  seriesEntries: WorkSeriesEntry[];

  stats: {
    averageRating: number;
    ratingsCount: number;
    reviewsCount: number;
    readersCount: number;
    currentlyReadingCount: number;
    wantToReadCount: number;
    editionsCount: number;
    ratings5: number;
    ratings4: number;
    ratings3: number;
    ratings2: number;
    ratings1: number;
  };

  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkSeriesEntry {
  seriesId: string;
  seriesName: string;
  position: string; // "1", "Vol. 3", "Livro 2", "Única"
  isPrimary: boolean; // Série exibida junto ao título
}

// =============================================================================
// EDIÇÃO (publicação específica)
// =============================================================================

export interface Edition {
  id: string;
  workId: string;
  title: string;
  subtitle?: string;
  description?: string;
  isbn13?: string;
  isbn10?: string;
  asin?: string;
  coverUrl?: string;
  userRating?: number;

  formatCategoryId: string;
  formatId: string;

  publisher?: EntityReference;
  imprint?: EntityReference;
  editionNumber?: number;
  publicationDate?: string;
  language: string;

  pages?: number;
  duration?: number; // minutos, para audiolivros
  dimensions?: {
    height?: number;    // cm
    width?: number;     // cm
    thickness?: number; // cm (lombada)
  };
  weight?: number; // gramas — necessário para cálculo de frete (Correios)

  contributors: EditionContributor[];
  purchaseLinks: PurchaseLink[];

  stats: {
    averageRating: number;
    ratingsCount: number;
    reviewsCount: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface EditionContributor {
  personId?: string;
  groupId?: string;
  name: string;
  role: ContributorRole;
  photoUrl?: string;
}

export interface PurchaseLink {
  platform: string;
  originalUrl: string;
  affiliateUrl?: string;
  lastPrice?: number;
  lastPriceDate?: Date;
  currency?: string;
}

// =============================================================================
// PESSOA
// =============================================================================

export interface Person {
  id: string;
  name: string;
  alternateNames?: AlternateName[];
  gender: PersonGender;
  bio?: string;
  photoUrl?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: PersonLocation;
  deathPlace?: PersonLocation;
  nationality?: string;
  website?: string;
  socialLinks: SocialLink[];
  encyclopediaLinks: EncyclopediaLink[];
  worksCount: number;
  followersCount: number;
  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonLocation {
  city?: string;
  district?: string;
  state?: string;
  stateCode?: string;
  country: string;
  displayFormat?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface EncyclopediaLink {
  source: string;
  url: string;
  language?: string;
}

// =============================================================================
// GRUPO DE AUTORES
// =============================================================================

export interface AuthorGroup {
  id: string;
  name: string;
  bio?: string;
  photoUrl?: string;
  memberIds: string[];
  memberNames: string[];
  worksCount: number;
  followersCount: number;
  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// EDITORA + SELO
// =============================================================================

export interface Publisher {
  id: string;
  name: string;
  website?: string;
  logoUrl?: string;
  alternateNames?: AlternateName[];
  imprints: PublisherImprint[];
  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublisherImprint {
  id: string;
  name: string;
  description?: string;
}

// =============================================================================
// SÉRIE / COLEÇÃO
// =============================================================================

export interface Series {
  id: string;
  name: string;
  description?: string;
  totalBooks?: number;
  primaryAuthors: {
    id: string;
    name: string;
    type: 'person' | 'group';
  }[];
  formatId?: string; // Para identificar o formato padrão do gridas (ex: tankobon vs omnibus do mesmo título)
  coverUrl?: string;

  // Séries relacionadas (ex: tankobon vs omnibus do mesmo título)
  relatedSeriesIds: string[];
  relatedSeriesNames: string[];
  seriesType?: string;           // 'tankobon', 'omnibus', 'kanzenban', 'bunko', etc.
  originalSeriesId?: string;     // Se derivada, qual a série original

  // Nomes alternativos
  alternateNames?: AlternateName[];

  // Links externos (Goodreads, AniList, MyAnimeList, etc.)
  externalLinks?: {
    source: string; // 'goodreads', 'anilist', 'myanimelist', 'bookbrainz', etc.
    url: string;
  }[];

  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// GÊNERO (hierárquico)
// =============================================================================

export interface Genre {
  id: string;
  name: string;
  parentId?: string;
  parentName?: string;
  description?: string;
  depth: number;
}

// =============================================================================
// ESTANTE DO USUÁRIO
// =============================================================================

export interface ShelfTags {
  owned: boolean;
  wishlist: boolean;
  yearlyGoal?: number;
  forTrade: boolean;
  forSale: boolean;
}

export interface UserShelf {
  id: string;
  userId: string;
  editionId: string;
  workId: string;
  status: UserBookStatus;
  rating?: number;
  timesRead: number;
  isFavorite: boolean;
  sortOrder: number;
  tags: ShelfTags;
  customShelfIds: string[];
  customTagIds: string[];
  bookTitle: string;
  bookCoverUrl?: string;
  authorNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PRATELEIRAS PERSONALIZADAS + TAGS
// =============================================================================

export interface CustomShelf {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  bookCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomTag {
  id: string;
  userId: string;
  name: string;
  color?: string;
  bookCount: number;
  createdAt: Date;
}

// =============================================================================
// SESSÕES DE LEITURA + PROGRESSO
// =============================================================================

export interface ReadingSession {
  id: string;
  shelfItemId: string;
  userId: string;
  editionId: string;
  sessionNumber: number;
  startedAt?: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'abandoned';
  totalPages?: number;
  currentPage?: number;
  currentPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressUpdate {
  id: string;
  sessionId: string;
  userId: string;
  page?: number;
  percentage?: number;
  comment?: string;
  createdAt: Date;
}

// =============================================================================
// CALENDÁRIO DE LEITURA DIÁRIA + STREAK
// =============================================================================

export interface ReadingDay {
  id: string;
  userId: string;
  date: string;
  minutesRead?: number;
  pagesRead?: number;
  sessionsActive: string[];
  createdAt: Date;
}

export interface ReadingStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string;
  totalDaysRead: number;
  updatedAt: Date;
}

// =============================================================================
// REVIEWS + COMENTÁRIOS
// =============================================================================

export interface Review {
  id: string;
  userId: string;
  editionId: string;
  workId: string;
  rating: number;
  userName: string;
  userNickname: string;
  userPhotoUrl?: string;
  title?: string;
  content: string;
  containsSpoiler: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  parentCommentId?: string;
  userId: string;
  userName: string;
  userNickname: string;
  userPhotoUrl?: string;
  content: string;
  likesCount: number;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PRÊMIOS
// =============================================================================

export interface Award {
  id: string;
  name: string;
  organization?: string;
  logoUrl?: string;
  createdAt: Date;
}

export interface BookAward {
  id: string;
  workId: string;
  awardId: string;
  awardName: string;
  year: number;
  category?: string;
  won: boolean;
  createdAt: Date;
}

export interface BookChoiceAward {
  id: string;
  year: number;
  status: 'nomination' | 'voting' | 'closed';
  categories: BookChoiceCategory[];
  nominationStartDate: Date;
  votingStartDate: Date;
  resultsDate: Date;
  minReadsForNomination: number;
  createdAt: Date;
}

export interface BookChoiceCategory {
  id: string;
  name: string;
  genreId?: string;
}

export interface BookChoiceNomination {
  id: string;
  awardId: string;
  categoryId: string;
  workId: string;
  workTitle: string;
  workCoverUrl?: string;
  votesCount: number;
  createdAt: Date;
}

export interface BookChoiceVote {
  id: string;
  userId: string;
  awardId: string;
  categoryId: string;
  nominationId: string;
  year: number;
  createdAt: Date;
}

// =============================================================================
// MODERAÇÃO (SUGESTÕES)
// =============================================================================

export interface ContentSuggestion {
  id: string;
  type: SuggestionType;
  suggestedBy: string;
  suggestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  data: Record<string, unknown>;
  createdEntityId?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

// =============================================================================
// DEDUPLICAÇÃO (MERGE)
// =============================================================================

export interface MergeRequest {
  id: string;
  sourceWorkId: string;
  targetWorkId: string;
  requestedBy: string;
  reviewedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  migratedReviews?: number;
  migratedShelfItems?: number;
  migratedRatings?: number;
  createdAt: Date;
  resolvedAt?: Date;
}

// =============================================================================
// RECOMENDAÇÃO DE LIVRO
// =============================================================================

export interface BookRecommendation {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  workId: string;
  editionId?: string;
  workTitle: string;
  workCoverUrl?: string;
  message?: string;
  status: 'pending' | 'seen' | 'added';
  createdAt: Date;
}
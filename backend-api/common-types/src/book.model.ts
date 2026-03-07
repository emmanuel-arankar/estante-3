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

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type MedalCategory =
  | 'genre'       // Leitura por gênero
  | 'pioneer'     // Primeiros cadastrados
  | 'profile'     // Perfil completo
  | 'trade'       // Trocas realizadas
  | 'social'      // Resenhas, amigos, recomendações
  | 'streak'      // Dias consecutivos lendo
  | 'marathon';   // Quantidade em período

export type SuggestionType = 'work' | 'edition' | 'person' | 'group'
  | 'publisher' | 'series' | 'genre' | 'format';

// =============================================================================
// OBRA (conceito abstrato)
// =============================================================================

export interface Work {
  id: string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  description?: string;
  coverUrl?: string;
  ageRating?: AgeRating;

  // Relações (desnormalizadas)
  primaryAuthorIds: string[];
  primaryAuthorNames: string[];
  primaryAuthorType: ('person' | 'group')[];
  genreIds: string[];
  genreNames: string[];

  // Séries (N:N)
  seriesEntries: WorkSeriesEntry[];

  // Estatísticas agregadas (de TODAS as edições)
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

  searchTerms: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkSeriesEntry {
  seriesId: string;
  seriesName: string;
  position: string; // "1", "Única", "1-3", "2.5"
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

  // Formato (referência ao JSON cadastrado)
  formatCategoryId: string;  // 'physical', 'digital', 'audio'
  formatId: string;          // 'paperback', 'kindle', 'audible'

  // Publicação
  publisherId?: string;
  publisherName?: string;
  imprintId?: string;
  imprintName?: string;
  publicationDate?: string;  // YYYY-MM-DD
  language: string;          // ex: 'pt-BR'

  // Detalhes
  pages?: number;
  duration?: number;         // Minutos (audiobooks)

  // Contribuidores
  contributors: EditionContributor[];

  // Links de compra
  purchaseLinks: PurchaseLink[];

  // Stats desta edição
  averageRating: number;
  ratingsCount: number;
  reviewsCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface EditionContributor {
  personId?: string;    // Mutuamente exclusivo
  groupId?: string;     // Mutuamente exclusivo
  name: string;         // Desnormalizado
  role: ContributorRole;
}

export interface PurchaseLink {
  platform: string;     // 'amazon', 'magalu', etc.
  originalUrl: string;
  affiliateUrl?: string;
  lastPrice?: number;
  lastPriceDate?: Date;
  currency?: string;
}

// =============================================================================
// PESSOA (autor, tradutor, ilustrador, etc.)
// =============================================================================

export interface Person {
  id: string;
  name: string;
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
  state?: string;
  stateCode?: string;
  country: string;
}

export interface SocialLink {
  platform: string; // 'twitter', 'instagram', etc.
  url: string;
}

export interface EncyclopediaLink {
  source: string;    // 'wikipedia', 'wikidata', etc.
  url: string;
  language?: string;
}

// =============================================================================
// GRUPO DE AUTORES (ex: CLAMP)
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
  imprints: PublisherImprint[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublisherImprint {
  id: string;
  name: string;          // Ex: "Panini Mangás", "Selo Ink"
  description?: string;
}

// =============================================================================
// SÉRIE
// =============================================================================

export interface Series {
  id: string;
  name: string;
  description?: string;
  totalBooks?: number;
  primaryAuthorId?: string;
  primaryAuthorName?: string;
  primaryAuthorType?: 'person' | 'group';
  coverUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// GÊNERO (hierárquico)
// =============================================================================

export interface Genre {
  id: string;          // slug ('dark-fantasy')
  name: string;        // 'Dark Fantasy'
  parentId?: string;   // 'fantasy'
  parentName?: string;
  description?: string;
  depth: number;       // 0=raiz, 1=filho
}

// =============================================================================
// ESTANTE DO USUÁRIO
// =============================================================================

export interface ShelfTags {
  owned: boolean;
  wishlist: boolean;
  yearlyGoal?: number;   // Ano da meta (ex: 2026)
  forTrade: boolean;
  forSale: boolean;
}

export interface UserShelf {
  id: string;                // `{userId}_{editionId}`
  userId: string;
  editionId: string;
  workId: string;
  status: UserBookStatus;
  rating?: number;           // 0.5 a 5
  timesRead: number;
  isFavorite: boolean;
  sortOrder: number;
  tags: ShelfTags;
  customShelfIds: string[];
  customTagIds: string[];

  // Dados desnormalizados
  bookTitle: string;
  bookCoverUrl?: string;
  authorNames: string[];

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PRATELEIRAS PERSONALIZADAS + TAGS CUSTOMIZÁVEIS
// =============================================================================

export interface CustomShelf {
  id: string;
  userId: string;
  name: string;            // "Terror", "HQs", "Mangás"
  description?: string;
  color?: string;          // Hex
  icon?: string;
  bookCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomTag {
  id: string;
  userId: string;
  name: string;            // "Favoritos 2026", "Emprestado"
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
  sessionNumber: number;     // 1ª leitura, 2ª...
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
  id: string;                // `{userId}_{YYYY-MM-DD}`
  userId: string;
  date: string;              // 'YYYY-MM-DD'
  minutesRead?: number;
  pagesRead?: number;
  sessionsActive: string[];
  createdAt: Date;
}

export interface ReadingStreak {
  id: string;                // `{userId}`
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string;      // 'YYYY-MM-DD'
  totalDaysRead: number;
  updatedAt: Date;
}

// =============================================================================
// REVIEWS + COMENTÁRIOS
// =============================================================================

export interface Review {
  id: string;
  userId: string;
  editionId: string;         // Review é da EDIÇÃO
  workId: string;            // Desnormalizado para agregação
  rating: number;

  // Dados do autor da review (desnormalizados)
  userName: string;
  userNickname: string;
  userPhotoUrl?: string;

  // Conteúdo rich text
  title?: string;
  content: string;           // HTML sanitizado (rich text)
  containsSpoiler: boolean;

  // Engajamento
  likesCount: number;
  commentsCount: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  parentCommentId?: string;  // Para replies
  userId: string;
  userName: string;
  userNickname: string;
  userPhotoUrl?: string;
  content: string;
  likesCount: number;
  depth: number;             // 0=top-level, 1=reply, 2=tréplica...
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PRÊMIOS
// =============================================================================

export interface Award {
  id: string;
  name: string;              // "Hugo Award"
  organization?: string;     // "World Science Fiction Society"
  logoUrl?: string;
  createdAt: Date;
}

export interface BookAward {
  id: string;
  workId: string;
  awardId: string;
  awardName: string;
  year: number;
  category?: string;         // "Best Novel"
  won: boolean;              // true=ganhou, false=indicado
  createdAt: Date;
}

// Book Choice Awards da Estante de Bolso
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
  name: string;              // "Melhor Fantasia"
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
  id: string;                // `{userId}_{categoryId}_{year}`
  userId: string;
  awardId: string;
  categoryId: string;
  nominationId: string;
  year: number;
  createdAt: Date;
}

// =============================================================================
// MEDALHAS (PIXEL ART)
// =============================================================================

export interface Medal {
  id: string;                // slug: 'genre-fantasy-gold', 'pioneer-100'
  name: string;              // "Mestre da Fantasia"
  description: string;       // "Leu 200 livros de Fantasia"
  category: MedalCategory;
  tier?: MedalTier;
  iconUrl: string;           // Pixel art illustration URL
  requirement: MedalRequirement;
  createdAt: Date;
}

export interface MedalRequirement {
  type: 'genre_books' | 'registration_order' | 'profile_complete'
  | 'trades_count' | 'reviews_count' | 'friends_count'
  | 'streak_days' | 'books_in_period' | 'recommendations';
  genreId?: string;
  threshold: number;
  period?: 'month' | 'year';
}

export interface UserMedal {
  id: string;                // `{userId}_{medalId}`
  userId: string;
  medalId: string;
  medalName: string;
  medalIconUrl: string;
  category: MedalCategory;
  tier?: MedalTier;
  multiplier: number;        // 1x, 2x...
  achievedAt: Date;
  seen: boolean;             // false = mostrar popup
}

export const GENRE_MEDAL_THRESHOLDS: Record<MedalTier, number> = {
  bronze: 50,
  silver: 100,
  gold: 200,
  platinum: 350,
  diamond: 500,
};

export const MULTIPLIER_INTERVAL = 500;

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
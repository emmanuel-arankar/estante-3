// =============================================================================
// SISTEMA DE MEDALHAS — MODELOS DE DADOS
// =============================================================================
// Módulo independente: medalhas podem ser concedidas por qualquer sistema
// (livros, perfil, social, pioneiro, etc.)

// =============================================================================
// TIPOS
// =============================================================================

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type MedalCategory =
    | 'genre'       // Leitura por gênero
    | 'pioneer'     // Primeiros cadastrados
    | 'profile'     // Perfil completo
    | 'trade'       // Trocas realizadas
    | 'social'      // Resenhas, amigos, recomendações
    | 'streak'      // Dias consecutivos lendo
    | 'marathon';   // Quantidade em período

// =============================================================================
// MEDALHA (definição)
// =============================================================================

export interface Medal {
    id: string;                  // slug: 'genre-fantasy-gold', 'pioneer-100'
    name: string;                // "Mestre da Fantasia"
    description: string;         // "Leu 200 livros de Fantasia"
    category: MedalCategory;
    tier?: MedalTier;            // Nem toda medalha tem tier (ex: pioneer)
    iconUrl: string;             // Pixel art illustration URL
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

// =============================================================================
// MEDALHA DO USUÁRIO (conquista)
// =============================================================================

export interface UserMedal {
    id: string;                  // `{userId}_{medalId}`
    userId: string;
    medalId: string;
    medalName: string;
    medalIconUrl: string;
    category: MedalCategory;
    tier?: MedalTier;
    multiplier: number;          // 1x, 2x...
    achievedAt: Date;
    seen: boolean;               // false = mostrar popup
}

// =============================================================================
// CONSTANTES
// =============================================================================

export const GENRE_MEDAL_THRESHOLDS: Record<MedalTier, number> = {
    bronze: 50,
    silver: 100,
    gold: 200,
    platinum: 350,
    diamond: 500,
};

export const MULTIPLIER_INTERVAL = 500;

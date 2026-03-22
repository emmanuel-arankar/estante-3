// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';
import { sanitize, sanitizeRichText } from '../lib/sanitize';

const entityRefSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
});

const alternateNameSchema = z.object({
    value: z.string().min(1, 'Nome variante não pode ser vazio').max(500),
    country: z.string().max(2).optional(),
    language: z.string().max(10).optional(),
    script: z.string().max(10).optional(),
    type: z.string().max(50).optional(),
    description: z.string().max(500).optional(),
});

// =============================================================================
// SCHEMAS DE OBRAS (WORKS)
// =============================================================================

/**
 * @name Schema de Criação de Obra
 * @summary Valida dados para criar uma nova obra.
 * @description Define regras para título, sinopse, autores e gêneros de uma obra.
 */
export const createWorkSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório').max(500)
        .transform(val => sanitize(val)),
    subtitle: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
    originalTitle: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
    alternateNames: z.array(alternateNameSchema).optional().default([]),
    originalLanguage: z.string().max(10).optional(),
    originalPublicationDate: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Data inválida (YYYY, YYYY-MM ou YYYY-MM-DD)').optional(),
    description: z.string().max(5000).optional()
        .transform(val => val ? sanitizeRichText(val) : val),
    ageRating: z.enum(['L', '10', '12', '14', '16', '18']).optional(),
    primaryAuthors: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(['person', 'group'])
    })).min(1, 'Pelo menos um autor é obrigatório'),
    genres: z.array(entityRefSchema).optional().default([]),
    themes: z.array(entityRefSchema).optional().default([]),
    locations: z.array(entityRefSchema).optional().default([]),
    seriesEntries: z.array(z.object({
        seriesId: z.string().min(1),
        seriesName: z.string().min(1),
        position: z.string().min(1), // "1", "Única", "1-3"
    })).optional().default([]),
});

export type CreateWorkInput = z.infer<typeof createWorkSchema>;

/**
 * @name Schema de Busca de Obras
 * @summary Valida parâmetros de busca.
 */
export const searchWorksQuerySchema = z.object({
    q: z.string().trim().min(2, 'Busca deve ter pelo menos 2 caracteres'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchWorksQuery = z.infer<typeof searchWorksQuerySchema>;

/**
 * @name Schema de ID de Obra
 * @summary Valida parâmetro workId.
 */
export const workIdParamSchema = z.object({
    workId: z.string().min(1, 'workId é obrigatório'),
});

export type WorkIdParam = z.infer<typeof workIdParamSchema>;

// =============================================================================
// SCHEMAS DE EDIÇÕES (EDITIONS)
// =============================================================================

/**
 * @name Schema de Criação de Edição
 * @summary Valida dados para criar uma nova edição.
 */
export const createEditionSchema = z.object({
    workId: z.string().min(1, 'workId é obrigatório'),
    title: z.string().min(1, 'Título é obrigatório').max(500)
        .transform(val => sanitize(val)),
    subtitle: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
    description: z.string().max(5000).optional()
        .transform(val => val ? sanitizeRichText(val) : val),
    isbn13: z.string().regex(/^\d{13}$/, 'ISBN-13 deve ter 13 dígitos').optional(),
    isbn10: z.string().regex(/^\d{10}$/, 'ISBN-10 deve ter 10 dígitos').optional(),
    asin: z.string().max(20).optional(),
    coverUrl: z.string().url().optional(),
    formatCategoryId: z.string().min(1, 'Categoria de formato é obrigatória'),
    formatId: z.string().min(1, 'Formato é obrigatório'),
    publisher: entityRefSchema.optional(),
    imprint: entityRefSchema.optional(),
    editionNumber: z.number().int().min(1).optional(),
    publicationDate: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Data inválida (YYYY, YYYY-MM ou YYYY-MM-DD)').optional(),
    language: z.string().min(2, 'Idioma é obrigatório').max(10),
    pages: z.number().int().min(1).optional(),
    duration: z.number().int().min(1).optional(),
    dimensions: z.object({
        height: z.number().positive().optional(),
        width: z.number().positive().optional(),
        thickness: z.number().positive().optional(),
    }).optional(),
    weight: z.number().int().min(1).optional(), // gramas
    contributors: z.array(z.object({
        personId: z.string().optional(),
        groupId: z.string().optional(),
        name: z.string().min(1),
        role: z.enum([
            'author', 'co-author', 'translator', 'illustrator',
            'cover-artist', 'editor', 'proofreader', 'preface',
            'postface', 'epilogue', 'narrator', 'revisor'
        ]),
    }).refine(
        data => (data.personId && !data.groupId) || (!data.personId && data.groupId),
        { message: 'Exatamente um de personId ou groupId deve ser informado' }
    )).optional().default([]),
    purchaseLinks: z.array(z.object({
        platform: z.string().min(1),
        originalUrl: z.string().url(),
    })).optional().default([]),
});

export type CreateEditionInput = z.infer<typeof createEditionSchema>;

/**
 * @name Schema de ID de Edição
 */
export const editionIdParamSchema = z.object({
    editionId: z.string().min(1, 'editionId é obrigatório'),
});

export type EditionIdParam = z.infer<typeof editionIdParamSchema>;

/**
 * @name Schema de Verificação de ISBN
 */
export const isbnParamSchema = z.object({
    isbn: z.string().min(10).max(13),
});

export type IsbnParam = z.infer<typeof isbnParamSchema>;

// =============================================================================
// SCHEMAS DE PESSOAS (PERSONS)
// =============================================================================

/**
 * @name Schema de Criação de Pessoa
 * @summary Valida dados para criar autor/tradutor/etc.
 */
export const createPersonSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(200)
        .transform(val => sanitize(val)),
    gender: z.enum(['male', 'female', 'non-binary', 'other', 'unknown']).default('unknown'),
    bio: z.string().max(5000).optional()
        .transform(val => val ? sanitizeRichText(val) : val),
    photoUrl: z.string().url().optional(),
    alternateNames: z.array(alternateNameSchema).optional().default([]),
    birthDate: z.string().optional(),
    deathDate: z.string().optional(),
    birthPlace: z.object({
        city: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        country: z.string().min(1),
        displayFormat: z.string().optional(),
    }).optional(),
    deathPlace: z.object({
        city: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        stateCode: z.string().optional(),
        country: z.string().min(1),
        displayFormat: z.string().optional(),
    }).optional(),
    nationality: z.string().max(100).optional(),
    website: z.string().url().or(z.literal('')).optional(),
    socialLinks: z.array(z.object({
        platform: z.string().min(1),
        url: z.string().url(),
    })).optional().default([]),
    encyclopediaLinks: z.array(z.object({
        source: z.string().min(1),
        url: z.string().url(),
        language: z.string().optional(),
    })).optional().default([]),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

/**
 * @name Schema de ID de Pessoa
 */
export const personIdParamSchema = z.object({
    personId: z.string().min(1, 'personId é obrigatório'),
});

export type PersonIdParam = z.infer<typeof personIdParamSchema>;

// =============================================================================
// SCHEMAS DE GRUPOS DE AUTORES
// =============================================================================

/**
 * @name Schema de Criação de Grupo
 */
export const createGroupSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(200)
        .transform(val => sanitize(val)),
    bio: z.string().max(5000).optional()
        .transform(val => val ? sanitizeRichText(val) : val),
    photoUrl: z.string().url().optional(),
    memberIds: z.array(z.string().min(1)).optional().default([]),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/**
 * @name Schema de ID de Grupo
 */
export const groupIdParamSchema = z.object({
    groupId: z.string().min(1, 'groupId é obrigatório'),
});

export type GroupIdParam = z.infer<typeof groupIdParamSchema>;

// =============================================================================
// SCHEMAS DE EDITORAS
// =============================================================================

/**
 * @name Schema de Criação de Editora
 */
export const createPublisherSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(200)
        .transform(val => sanitize(val)),
    website: z.string().url().or(z.literal('')).optional(),
    alternateNames: z.array(alternateNameSchema).optional().default([]),
    logoUrl: z.string().url().optional(),
    imprints: z.array(z.object({
        name: z.string().min(1),
        description: z.string().max(500).optional(),
    })).optional().default([]),
});

export type CreatePublisherInput = z.infer<typeof createPublisherSchema>;

// =============================================================================
// SCHEMAS DE SÉRIES
// =============================================================================

/**
 * @name Schema de Criação de Série
 */
export const createSeriesSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(300)
        .transform(val => sanitize(val)),
    description: z.string().max(3000).optional()
        .transform(val => val ? sanitize(val) : val),
    totalBooks: z.number().int().min(1).optional(),
    primaryAuthors: z.array(z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(['person', 'group'])
    })).optional(),
    relatedSeriesIds: z.array(z.string().min(1)).optional().default([]),
    seriesType: z.string().max(50).optional(),
    originalSeriesId: z.string().optional(),
    alternateNames: z.array(alternateNameSchema).optional().default([]),
    externalLinks: z.array(z.object({
        source: z.string().min(1).max(50),
        url: z.string().url(),
    })).optional().default([]),
});

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;

// =============================================================================
// SCHEMAS DE ESTANTE DO USUÁRIO
// =============================================================================

/**
 * @name Schema de Adição à Estante
 * @summary Valida dados para adicionar um livro à estante.
 */
export const addToShelfSchema = z.object({
    editionId: z.string().min(1, 'editionId é obrigatório'),
    status: z.enum(['reading', 'completed', 'want-to-read', 'abandoned', 'on-hold']),
    rating: z.number().min(0.5).max(5).multipleOf(0.5).optional(),
    tags: z.object({
        owned: z.boolean().default(false),
        wishlist: z.boolean().default(false),
        yearlyGoal: z.number().int().optional(),
        forTrade: z.boolean().default(false),
        forSale: z.boolean().default(false),
    }).optional().default({
        owned: false, wishlist: false, forTrade: false, forSale: false,
    }),
    customShelfIds: z.array(z.string()).optional().default([]),
    customTagIds: z.array(z.string()).optional().default([]),
});

export type AddToShelfInput = z.infer<typeof addToShelfSchema>;

/**
 * @name Schema de Atualização de Item da Estante
 */
export const updateShelfSchema = z.object({
    status: z.enum(['reading', 'completed', 'want-to-read', 'abandoned', 'on-hold']).optional(),
    rating: z.number().min(0.5).max(5).multipleOf(0.5).optional().nullable(),
    isFavorite: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    tags: z.object({
        owned: z.boolean().optional(),
        wishlist: z.boolean().optional(),
        yearlyGoal: z.number().int().optional().nullable(),
        forTrade: z.boolean().optional(),
        forSale: z.boolean().optional(),
    }).optional(),
    customShelfIds: z.array(z.string()).optional(),
    customTagIds: z.array(z.string()).optional(),
});

export type UpdateShelfInput = z.infer<typeof updateShelfSchema>;

/**
 * @name Schema de ID de Item da Estante
 */
export const shelfItemIdParamSchema = z.object({
    shelfItemId: z.string().min(1, 'shelfItemId é obrigatório'),
});

export type ShelfItemIdParam = z.infer<typeof shelfItemIdParamSchema>;

/**
 * @name Schema de Reordenação da Estante (batch)
 */
export const reorderShelfSchema = z.object({
    items: z.array(z.object({
        shelfItemId: z.string().min(1),
        sortOrder: z.number().int().min(0),
    })).min(1).max(200),
});

export type ReorderShelfInput = z.infer<typeof reorderShelfSchema>;

/**
 * @name Schema de Listagem da Estante
 */
export const listShelfQuerySchema = z.object({
    status: z.enum(['reading', 'completed', 'want-to-read', 'abandoned', 'on-hold']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['sortOrder', 'updatedAt', 'rating', 'bookTitle']).default('sortOrder'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
    customShelfId: z.string().optional(),
    customTagId: z.string().optional(),
});

export type ListShelfQuery = z.infer<typeof listShelfQuerySchema>;

// =============================================================================
// SCHEMAS DE SESSÕES DE LEITURA
// =============================================================================

/**
 * @name Schema de Progresso de Leitura
 */
export const createProgressSchema = z.object({
    page: z.number().int().min(0).optional(),
    percentage: z.number().min(0).max(100).optional(),
    comment: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
}).refine(
    data => data.page !== undefined || data.percentage !== undefined,
    { message: 'Informe page ou percentage' }
);

export type CreateProgressInput = z.infer<typeof createProgressSchema>;

/**
 * @name Schema de ID de Sessão
 */
export const sessionIdParamSchema = z.object({
    sessionId: z.string().min(1, 'sessionId é obrigatório'),
});

export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;

// =============================================================================
// SCHEMAS DE REVIEWS
// =============================================================================

/**
 * @name Schema de Criação de Review
 */
export const createReviewSchema = z.object({
    editionId: z.string().min(1, 'editionId é obrigatório'),
    workId: z.string().optional(), // Opcional no schema, mas robustecido no backend
    rating: z.number().min(0).max(5).multipleOf(0.5).optional().nullable(),
    title: z.any().transform(val => typeof val === 'string' ? sanitize(val) : val),
    content: z.any().transform(val => typeof val === 'string' ? sanitizeRichText(val) : val),
    containsSpoiler: z.boolean().default(false).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * @name Schema de Atualização de Review
 */
export const updateReviewSchema = z.object({
    rating: z.number().min(0).max(5).multipleOf(0.5).optional().nullable(),
    title: z.any().transform(val => typeof val === 'string' ? sanitize(val) : val),
    content: z.any().transform(val => typeof val === 'string' ? sanitizeRichText(val) : val),
    containsSpoiler: z.boolean().optional(),
});

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

/**
 * @name Schema de ID de Review
 */
export const reviewIdParamSchema = z.object({
    reviewId: z.string().min(1, 'reviewId é obrigatório'),
});

export type ReviewIdParam = z.infer<typeof reviewIdParamSchema>;

// =============================================================================
// SCHEMAS DE COMENTÁRIOS EM REVIEWS
// =============================================================================

/**
 * @name Schema de Comentário
 */
export const createCommentSchema = z.object({
    content: z.string().min(1, 'Conteúdo é obrigatório').max(2000)
        .transform(val => sanitizeRichText(val)),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/**
 * @name Schema de Atualização de Comentário
 */
export const updateCommentSchema = z.object({
    content: z.string().min(1, 'Conteúdo é obrigatório').max(2000)
        .transform(val => sanitizeRichText(val)),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

/**
 * @name Schema de ID de Comentário
 */
export const commentIdParamSchema = z.object({
    commentId: z.string().min(1, 'commentId é obrigatório'),
});

export type CommentIdParam = z.infer<typeof commentIdParamSchema>;

// =============================================================================
// SCHEMAS DE PRATELEIRAS E TAGS PERSONALIZADAS
// =============================================================================

/**
 * @name Schema de Prateleira Personalizada
 */
export const createCustomShelfSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(100)
        .transform(val => sanitize(val)),
    description: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser hexadecimal (#RRGGBB)').optional(),
    icon: z.string().max(50).optional(),
});

export type CreateCustomShelfInput = z.infer<typeof createCustomShelfSchema>;

/**
 * @name Schema de Tag Personalizada
 */
export const createCustomTagSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(50)
        .transform(val => sanitize(val)),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateCustomTagInput = z.infer<typeof createCustomTagSchema>;

// =============================================================================
// SCHEMAS DE SUGESTÕES DE CONTEÚDO
// =============================================================================

/**
 * @name Schema de Sugestão de Conteúdo
 * @description Suporta sugestão de novas entidades (work, edition, etc.) e correções em dados existentes.
 */
export const createSuggestionSchema = z.object({
    type: z.enum(['work', 'edition', 'person', 'group', 'publisher', 'series', 'genre', 'format', 'correction']),
    data: z.record(z.string(), z.any()),
    // Para sugestões de correção: campos alterados com valor antigo e novo
    corrections: z.array(z.object({
        field: z.string().min(1),
        oldValue: z.any(),
        newValue: z.any(),
    })).optional(),
    // Para sugestões de edição: informações extras de vínculo
    seriesEntries: z.array(z.object({
        seriesId: z.string().optional(), // undefined = criar nova série
        seriesName: z.string().min(1),
        position: z.string().min(1).max(20),
        isPrimary: z.boolean().default(false),
    })).optional().default([]),
    unlinkedAuthors: z.array(z.object({
        name: z.string().min(1),
        role: z.string().min(1),
    })).optional().default([]),
    targetEntityId: z.string().optional(), // Para correction: ID da entidade sendo corrigida
});

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;

/**
 * @name Schema de Avaliação de Sugestão (Library)
 */
export const reviewSuggestionSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    reviewNote: z.string().max(500).optional(),
    updatedData: z.record(z.string(), z.any()).optional(),
});

export type ReviewSuggestionInput = z.infer<typeof reviewSuggestionSchema>;

// =============================================================================
// SCHEMAS DE RECOMENDAÇÃO
// =============================================================================

/**
 * @name Schema de Recomendação
 */
export const createRecommendationSchema = z.object({
    receiverId: z.string().min(1, 'receiverId é obrigatório'),
    workId: z.string().min(1, 'workId é obrigatório'),
    editionId: z.string().optional(),
    message: z.string().max(500).optional()
        .transform(val => val ? sanitize(val) : val),
});

export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;

// =============================================================================
// SCHEMAS DE LEITURA DIÁRIA
// =============================================================================

/**
 * @name Schema de Marcar Dia de Leitura
 */
export const createReadingDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD'),
    minutesRead: z.number().int().min(1).optional(),
    pagesRead: z.number().int().min(1).optional(),
});

export type CreateReadingDayInput = z.infer<typeof createReadingDaySchema>;

/**
 * @name Schema de ID de Usuário (genérico)
 */
export const userIdParamSchema = z.object({
    userId: z.string().min(1, 'userId é obrigatório'),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

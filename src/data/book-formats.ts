/**
 * Dados de formatos de livro (categorias e subformatos)
 * Padrão: brazil-locations.json → locations.ts
 */

import formatData from './book-formats.json';

// =============================================================================
// TIPOS
// =============================================================================

export interface BookFormat {
    id: string;
    name: string;
}

export interface FormatCategory {
    id: string;
    name: string;
    formats: BookFormat[];
}

export interface FormatData {
    categories: FormatCategory[];
}

// =============================================================================
// DADOS
// =============================================================================

export const bookFormats = formatData as FormatData;

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * Retorna lista de todas as categorias de formato
 */
export function getFormatCategories(): FormatCategory[] {
    return bookFormats.categories;
}

/**
 * Retorna formatos de uma categoria específica
 */
export function getFormatsByCategory(categoryId: string): BookFormat[] {
    const category = bookFormats.categories.find(c => c.id === categoryId);
    return category?.formats || [];
}

/**
 * Busca categoria pelo ID
 */
export function getCategoryById(categoryId: string): FormatCategory | undefined {
    return bookFormats.categories.find(c => c.id === categoryId);
}

/**
 * Busca formato pelo ID (em qualquer categoria)
 */
export function getFormatById(formatId: string): (BookFormat & { categoryId: string }) | undefined {
    for (const category of bookFormats.categories) {
        const format = category.formats.find(f => f.id === formatId);
        if (format) {
            return { ...format, categoryId: category.id };
        }
    }
    return undefined;
}

/**
 * Retorna todos os IDs de formato válidos
 */
export function getAllFormatIds(): string[] {
    return bookFormats.categories.flatMap(c => c.formats.map(f => f.id));
}

/**
 * Retorna todos os IDs de categoria válidos
 */
export function getAllCategoryIds(): string[] {
    return bookFormats.categories.map(c => c.id);
}

/**
 * Valida se um formatId pertence à categoryId informada
 */
export function isFormatInCategory(formatId: string, categoryId: string): boolean {
    const category = bookFormats.categories.find(c => c.id === categoryId);
    if (!category) return false;
    return category.formats.some(f => f.id === formatId);
}

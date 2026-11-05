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
  icon?: string;
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
// LOOKUP MAPS O(1)
// =============================================================================

/**
 * Maps para busca O(1) de categorias e formatos, evitando iterações lineares
 * repetidas em renderizações de listas e filtros (ex: BookPage, EditionsPage).
 */
const CATEGORY_MAP = new Map<string, FormatCategory>();
const FORMAT_WITH_CATEGORY_MAP = new Map<string, BookFormat & { categoryId: string }>();
const FORMAT_CATEGORY_ICON_MAP = new Map<string, string | undefined>();
const CATEGORY_FORMAT_IDS_MAP = new Map<string, Set<string>>();

for (const category of bookFormats.categories) {
  CATEGORY_MAP.set(category.id, category);
  const formatIds = new Set<string>();

  for (const format of category.formats) {
    formatIds.add(format.id);
    FORMAT_WITH_CATEGORY_MAP.set(format.id, { ...format, categoryId: category.id });
    if (category.icon) {
      FORMAT_CATEGORY_ICON_MAP.set(format.id, category.icon);
    }
  }

  CATEGORY_FORMAT_IDS_MAP.set(category.id, formatIds);
}

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
 * Retorna formatos de uma categoria específica (O(1))
 */
export function getFormatsByCategory(categoryId: string): BookFormat[] {
  return CATEGORY_MAP.get(categoryId)?.formats || [];
}

/**
 * Busca categoria pelo ID (O(1))
 */
export function getCategoryById(categoryId: string): FormatCategory | undefined {
  return CATEGORY_MAP.get(categoryId);
}

/**
 * Retorna o ícone principal atrelado à categoria de um formato (se disponível) (O(1))
 */
export function getCategoryIconByFormatId(formatId: string): string | undefined {
  return FORMAT_CATEGORY_ICON_MAP.get(formatId);
}

/**
 * Busca formato pelo ID (em qualquer categoria) (O(1))
 */
export function getFormatById(formatId: string): (BookFormat & { categoryId: string }) | undefined {
  return FORMAT_WITH_CATEGORY_MAP.get(formatId);
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
 * Valida se um formatId pertence à categoryId informada (O(1))
 */
export function isFormatInCategory(formatId: string, categoryId: string): boolean {
  return CATEGORY_FORMAT_IDS_MAP.get(categoryId)?.has(formatId) ?? false;
}

import { describe, it, expect } from 'vitest';
import {
  getFormatCategories,
  getFormatsByCategory,
  getCategoryById,
  getCategoryIconByFormatId,
  getFormatById,
  getAllFormatIds,
  getAllCategoryIds,
  isFormatInCategory,
  bookFormats,
} from './book-formats';

describe('book-formats utility functions', () => {
  it('returns all format categories', () => {
    const categories = getFormatCategories();
    expect(categories).toBe(bookFormats.categories);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('retrieves category by ID correctly', () => {
    const physical = getCategoryById('physical');
    expect(physical).toBeDefined();
    expect(physical?.id).toBe('physical');
    expect(physical?.name).toBe('Físico');

    const nonExistent = getCategoryById('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('retrieves formats by category', () => {
    const physicalFormats = getFormatsByCategory('physical');
    expect(physicalFormats.length).toBeGreaterThan(0);
    expect(physicalFormats.some(f => f.id === 'paperback')).toBe(true);

    const emptyFormats = getFormatsByCategory('non-existent');
    expect(emptyFormats).toEqual([]);
  });

  it('retrieves category icon by format ID', () => {
    expect(getCategoryIconByFormatId('paperback')).toBe('book-open');
    expect(getCategoryIconByFormatId('ebook')).toBe('tablet');
    expect(getCategoryIconByFormatId('audiobook')).toBe('headphones');
    expect(getCategoryIconByFormatId('unknown-id')).toBeUndefined();
  });

  it('retrieves format by ID along with its categoryId', () => {
    const paperback = getFormatById('paperback');
    expect(paperback).toEqual({
      id: 'paperback',
      name: 'Brochura',
      categoryId: 'physical',
    });

    const ebook = getFormatById('ebook');
    expect(ebook).toEqual({
      id: 'ebook',
      name: 'eBook',
      categoryId: 'digital',
    });

    const nonExistent = getFormatById('invalid-format');
    expect(nonExistent).toBeUndefined();
  });

  it('retrieves all format IDs and category IDs', () => {
    const formatIds = getAllFormatIds();
    expect(formatIds).toContain('paperback');
    expect(formatIds).toContain('ebook');
    expect(formatIds).toContain('audiobook');

    const categoryIds = getAllCategoryIds();
    expect(categoryIds).toEqual(['physical', 'digital', 'audio']);
  });

  it('checks if a format is in a category', () => {
    expect(isFormatInCategory('paperback', 'physical')).toBe(true);
    expect(isFormatInCategory('ebook', 'digital')).toBe(true);
    expect(isFormatInCategory('audiobook', 'physical')).toBe(false);
    expect(isFormatInCategory('non-existent', 'physical')).toBe(false);
    expect(isFormatInCategory('paperback', 'non-existent')).toBe(false);
  });
});

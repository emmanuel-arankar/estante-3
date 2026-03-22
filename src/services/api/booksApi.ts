/**
 * Serviço centralizado para operações de livros (obras, edições, autores, etc.)
 */

import { apiClient } from '@/services/api/apiClient';
import { Work, Edition, Person, AuthorGroup, Series, Publisher, Genre } from '@estante/common-types';

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// =============================================================================
// OBRAS (WORKS)
// =============================================================================

export const searchWorksAPI = async (q: string, page = 1, limit = 20): Promise<PaginatedResponse<Work>> => {
    return await apiClient(`/books/works/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
};

export const getWorkAPI = async (workId: string): Promise<Work> => {
    return await apiClient(`/books/works/${workId}`);
};

// =============================================================================
// EDIÇÕES (EDITIONS)
// =============================================================================

export const getEditionsByWorkAPI = async (workId: string): Promise<PaginatedResponse<Edition>> => {
    return await apiClient(`/books/works/${workId}/editions`);
};

export const getWorkEditionsAPI = async (workId: string): Promise<PaginatedResponse<Edition>> => {
    return await apiClient(`/books/works/${workId}/editions`);
};

export const getEditionAPI = async (editionId: string): Promise<Edition> => {
    return await apiClient(`/books/editions/${editionId}`);
};

export const checkIsbnAPI = async (isbn: string): Promise<{ exists: boolean; editionId?: string; edition?: any }> => {
    return await apiClient(`/books/editions/check-isbn/${isbn}`);
};

export const enrichIsbnAPI = async (isbn: string): Promise<{
    source: string; title: string | null; subtitle: string | null;
    description: string | null; authors: { name: string; role: string }[];
    publisher: string | null; publicationDate: string | null; pages: number | null;
    language: string | null; coverUrl: string | null; isbn13: string | null;
    isbn10: string | null; categories: string[];
    alternateNames?: any[];
}> => {
    return await apiClient(`/books/editions/enrich-isbn/${isbn}`);
};

export const getWorkEditionsFilteredAPI = async (
    workId: string,
    params: { 
        language?: string; 
        formatId?: string; 
        publisher?: string; 
        year?: string; 
        sortBy?: string;
        sortDirection?: 'asc' | 'desc';
        page?: number; 
        limit?: number 
    }
): Promise<PaginatedResponse<Edition>> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.append(k, String(v)); });
    return await apiClient(`/books/works/${workId}/editions?${qs.toString()}`);
};

export const createSuggestionAPI = async (data: {
    type: string; data: Record<string, any>;
    corrections?: { field: string; oldValue: any; newValue: any }[];
    seriesEntries?: { seriesId?: string; seriesName: string; position: string; isPrimary: boolean }[];
    unlinkedAuthors?: { name: string; role: string }[];
    targetEntityId?: string;
}): Promise<{ id: string; message: string }> => {
    return await apiClient('/books/suggestions', { method: 'POST', data });
};

// =============================================================================
// PESSOAS E AUTORES
// =============================================================================

export const searchPersonsAPI = async (q: string, page = 1, limit = 20): Promise<Person[]> => {
    return await apiClient(`/books/persons/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
};

export const getPersonAPI = async (personId: string): Promise<Person> => {
    return await apiClient(`/books/persons/${personId}`);
};

export const getPersonEditionsAPI = async (personId: string, page = 1, limit = 50): Promise<PaginatedResponse<Edition>> => {
    return await apiClient(`/books/persons/${personId}/editions?page=${page}&limit=${limit}`);
};

export const getGroupAPI = async (groupId: string): Promise<AuthorGroup> => {
    return await apiClient(`/books/groups/${groupId}`);
};

export const getGroupEditionsAPI = async (groupId: string): Promise<{ data: Edition[] }> => {
    return await apiClient(`/books/groups/${groupId}/editions`);
};

// =============================================================================
// SÉRIES, EDITORAS E GÊNEROS
// =============================================================================

export const searchPublishersAPI = async (q: string): Promise<Publisher[]> => {
    return await apiClient(`/books/publishers/search?q=${encodeURIComponent(q)}`);
};

export const getPublisherAPI = async (id: string): Promise<Publisher> => {
    return await apiClient(`/books/publishers/${id}`);
};

export const searchSeriesAPI = async (q: string): Promise<Series[]> => {
    return await apiClient(`/books/series/search?q=${encodeURIComponent(q)}`);
};

export const getSeriesAPI = async (id: string): Promise<Series> => {
    return await apiClient(`/books/series/${id}`);
};

export const listGenresAPI = async (): Promise<Genre[]> => {
    return await apiClient('/books/genres');
};

// =============================================================================
// ESTANTE DO USUÁRIO (USER SHELF)
// =============================================================================

export interface ShelfParams {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    customShelfId?: string;
    customTagId?: string;
}

export const listMyShelfAPI = async (params: ShelfParams = {}): Promise<PaginatedResponse<any>> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.append(k, String(v)); });
    return await apiClient(`/books/shelf?${qs.toString()}`);
};

export const listUserShelfAPI = async (userId: string, params: ShelfParams = {}): Promise<PaginatedResponse<any>> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.append(k, String(v)); });
    return await apiClient(`/books/shelf/${userId}?${qs.toString()}`);
};

export const addToShelfAPI = async (data: any): Promise<{ id: string }> => {
    return await apiClient('/books/shelf', { method: 'POST', data });
};

export const updateShelfItemAPI = async (itemId: string, data: any): Promise<void> => {
    return await apiClient(`/books/shelf/${itemId}`, { method: 'PATCH', data });
};

export const removeFromShelfAPI = async (itemId: string): Promise<void> => {
    return await apiClient(`/books/shelf/${itemId}`, { method: 'DELETE' });
};

// =============================================================================
// REVIEWS
// =============================================================================

export const listReviewsAPI = async (editionId: string, page = 1, limit = 20): Promise<PaginatedResponse<any>> => {
    return await apiClient(`/books/editions/${editionId}/reviews?page=${page}&limit=${limit}`);
};

export const createReviewAPI = async (data: any): Promise<{ id: string }> => {
    return await apiClient('/books/reviews', { method: 'POST', data });
};

export const deleteReviewAPI = async (reviewId: string): Promise<void> => {
    return await apiClient(`/books/reviews/${reviewId}`, { method: 'DELETE' });
};

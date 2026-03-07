/**
 * Serviço centralizado para operações de livros (obras, edições, autores, etc.)
 */

import { apiClient } from '@/services/apiClient';
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

export const getEditionsByWorkAPI = async (workId: string): Promise<Edition[]> => {
    return await apiClient(`/books/works/${workId}/editions`);
};

export const getEditionAPI = async (editionId: string): Promise<Edition> => {
    return await apiClient(`/books/editions/${editionId}`);
};

export const checkIsbnAPI = async (isbn: string): Promise<{ exists: boolean; editionId?: string; isWorkLevel?: boolean; workId?: string }> => {
    return await apiClient(`/books/editions/check-isbn/${isbn}`);
};

// =============================================================================
// PESSOAS E AUTORES
// =============================================================================

export const searchPersonsAPI = async (q: string, page = 1, limit = 20): Promise<PaginatedResponse<Person>> => {
    return await apiClient(`/books/persons/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
};

export const getPersonAPI = async (personId: string): Promise<Person> => {
    return await apiClient(`/books/persons/${personId}`);
};

export const getGroupAPI = async (groupId: string): Promise<AuthorGroup> => {
    return await apiClient(`/books/groups/${groupId}`);
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

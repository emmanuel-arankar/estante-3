/**
 * Serviço para operações de curadoria de sugestões de conteúdo (admin/bibliotecário)
 */

import { apiClient } from '@/services/api/apiClient';
import { PaginatedResponse } from '@/services/api/booksApi';

export interface ContentSuggestion {
    id: string;
    type: 'work' | 'edition' | 'person' | 'group' | 'publisher' | 'series' | 'genre' | 'format' | 'correction';
    status: 'pending' | 'approved' | 'rejected';
    data: Record<string, any>;
    corrections?: { field: string; oldValue: any; newValue: any }[];
    seriesEntries?: { seriesId?: string; seriesName: string; position: string; isPrimary: boolean }[];
    unlinkedAuthors?: { name: string; role: string }[];
    targetEntityId?: string;
    submittedBy: string;
    submittedByName?: string;
    reviewedBy?: string;
    reviewedByRole?: string;
    reviewNote?: string;
    createdAt: Date | string;
    resolvedAt?: Date | string;
}

export interface ListSuggestionsParams {
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    type?: ContentSuggestion['type'];
    page?: number;
    limit?: number;
}

export const listSuggestionsAdminAPI = async (
    params: ListSuggestionsParams = {}
): Promise<PaginatedResponse<ContentSuggestion>> => {
    const qs = new URLSearchParams();
    if (params.status) qs.append('status', params.status);
    if (params.type) qs.append('type', params.type);
    if (params.page) qs.append('page', String(params.page));
    if (params.limit) qs.append('limit', String(params.limit));
    return await apiClient(`/curatorship/suggestions?${qs.toString()}`);
};

export const getSuggestionAdminAPI = async (id: string): Promise<ContentSuggestion> => {
    return await apiClient(`/curatorship/suggestions/${id}`);
};

export const reviewSuggestionAPI = async (
    id: string,
    data: { status: 'approved' | 'rejected'; reviewNote?: string; updatedData?: Record<string, any> }
): Promise<{ message: string }> => {
    return await apiClient(`/curatorship/suggestions/${id}/review`, {
        method: 'PATCH',
        data,
    });
};

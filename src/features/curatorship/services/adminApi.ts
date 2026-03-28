import { apiClient } from '@/services/api/apiClient';

/**
 * Atualiza uma Obra (Work) diretamente (Apenas Bibliotecários e Admins).
 */
export const updateWorkAdminAPI = async (workId: string, data: Record<string, any>): Promise<{ message: string }> => {
    return await apiClient(`/curatorship/works/${workId}`, { method: 'PATCH', data });
};

/**
 * Atualiza uma Edição (Edition) diretamente (Apenas Bibliotecários e Admins).
 */
export const updateEditionAdminAPI = async (editionId: string, data: Record<string, any>): Promise<{ message: string }> => {
    return await apiClient(`/curatorship/editions/${editionId}`, { method: 'PATCH', data });
};

/**
 * Atualiza uma Pessoa/Autor (Person) diretamente (Apenas Bibliotecários e Admins).
 */
export const updatePersonAdminAPI = async (personId: string, data: Record<string, any>): Promise<{ message: string }> => {
    return await apiClient(`/curatorship/persons/${personId}`, { method: 'PATCH', data });
};

/**
 * Atualiza uma Editora (Publisher) diretamente (Apenas Bibliotecários e Admins).
 */
export const updatePublisherAdminAPI = async (publisherId: string, data: Record<string, any>): Promise<{ message: string }> => {
    return await apiClient(`/curatorship/publishers/${publisherId}`, { method: 'PATCH', data });
};

import { apiClient } from './apiClient';

interface GoogleAuthParams {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string | null;
}

interface AuthResponse {
    customToken?: string;
    message?: string;
    isNewUser?: boolean;
}

export const registerAPI = async (data: any): Promise<AuthResponse> => {
    const res = await apiClient<any>('/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.data || res; // Retorna o res.data desembrulhado pelo Wrapper Global ou a resposta direta
};

export const loginAPI = async (data: any): Promise<AuthResponse> => {
    const res = await apiClient<any>('/login', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.data || res;
};

export const recoverPasswordAPI = async (email: string): Promise<AuthResponse> => {
    const res = await apiClient<any>('/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
    return res.data || res;
};

export const googleAuthAPI = async (data: GoogleAuthParams): Promise<AuthResponse> => {
    const res = await apiClient<any>('/google', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return res.data || res;
};

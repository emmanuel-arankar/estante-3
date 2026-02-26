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
    return apiClient<AuthResponse>('/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const loginAPI = async (data: any): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const recoverPasswordAPI = async (email: string): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
};

export const googleAuthAPI = async (data: GoogleAuthParams): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/google', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

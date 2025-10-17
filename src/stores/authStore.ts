import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  isLoadingProfile: boolean;
  loadingMessage: string | null; // # atualizado
  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsLoadingProfile: (isLoadingProfile: boolean, message?: string | null) => void;
  initializeUser: (user: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  isLoadingProfile: false,
  loadingMessage: null, // # atualizado
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsLoadingProfile: (isLoadingProfile, message = null) => set({ isLoadingProfile, loadingMessage: message }), // # atualizado
  initializeUser: (user) => set({ user, loading: false }),
  clearAuth: () => set({
    user: null,
    loading: false,
    error: null,
    isLoadingProfile: false,
    loadingMessage: null
  }),
}));

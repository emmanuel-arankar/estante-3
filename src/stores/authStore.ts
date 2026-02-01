import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@estante/common-types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: User | null;  // Perfil completo do Firestore
  loading: boolean;
  error: string | null;
  isLoadingProfile: boolean;
  loadingMessage: string | null;
  setUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsLoadingProfile: (isLoadingProfile: boolean, message?: string | null) => void;
  initializeUser: (user: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  isLoadingProfile: false,
  loadingMessage: null,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setIsLoadingProfile: (isLoadingProfile, message = null) => set({ isLoadingProfile, loadingMessage: message }),
  initializeUser: (user) => set({ user, loading: false }),
  clearAuth: () => set({
    user: null,
    userProfile: null,
    loading: false,
    error: null,
    isLoadingProfile: false,
    loadingMessage: null
  }),
}));

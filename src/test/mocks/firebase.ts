import { vi } from 'vitest';

/**
 * Mocks do Firebase Auth
 */
export const mockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((authOrCallback, callbackOrUndefined) => {
    // Simula usuário autenticado de forma assíncrona (como a API real)
    const callback = typeof authOrCallback === 'function' ? authOrCallback : callbackOrUndefined;
    if (typeof callback === 'function') {
      Promise.resolve().then(() => callback(null));
    }
    return vi.fn(); // unsubscribe function
  }),
  updateProfile: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
};

/**
 * Mocks do Firestore
 */
export const mockFirestore = {
  collection: vi.fn(),
  doc: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    onSnapshot: vi.fn(),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
};

/**
 * Mocks do Storage
 */
export const mockStorage = {
  ref: vi.fn(() => ({
    put: vi.fn(),
    putString: vi.fn(),
    getDownloadURL: vi.fn(),
    delete: vi.fn(),
  })),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
};

/**
 * Mocks do Functions
 */
export const mockFunctions = {
  httpsCallable: vi.fn(() => vi.fn()),
};

/**
 * Helper para resetar todos os mocks
 */
export function resetAllFirebaseMocks() {
  vi.clearAllMocks();
  mockAuth.currentUser = null;
}

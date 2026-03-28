import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor() { }
  disconnect() { }
  observe() { }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() { }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() { }
  disconnect() { }
  observe() { }
  unobserve() { }
};

// Suppress console errors em testes
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock Firebase Modules Globally
import { mockAuth, mockFirestore, mockStorage, mockFunctions } from './mocks/firebase';

vi.mock('firebase/auth', () => mockAuth);
vi.mock('firebase/firestore', () => mockFirestore);
vi.mock('firebase/storage', () => mockStorage);
vi.mock('firebase/functions', () => mockFunctions);

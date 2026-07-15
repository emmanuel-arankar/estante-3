import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { bucket } from '../firebase';

/**
 * @name Mock Factory Storage
 * @summary Gerador de ambiente de storage para testes.
 */
const { mockBucket } = vi.hoisted(() => {
    const mockFile = (path: string) => ({
        getSignedUrl: vi.fn(() => Promise.resolve([`https://signed-url.com/${path}`])),
        exists: vi.fn(() => Promise.resolve([path.includes('exists')])),
        delete: vi.fn(() => Promise.resolve()),
    });

    const mockBucket = {
        name: 'test-bucket',
        file: vi.fn((path) => mockFile(path)),
    };

    return { mockBucket };
});

// Mocking Firebase Admin
vi.mock('../firebase', () => ({
    admin: {
        auth: () => ({}),
    },
    bucket: mockBucket,
}));

// Mocking Auth Middleware
vi.mock('../middleware/auth.middleware', () => ({

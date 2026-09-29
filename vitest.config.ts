import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        env: {
            FIREBASE_DATABASE_URL: `https://${process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463'}-default-rtdb.firebaseio.com`,
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData/',
                'dist/',
                '**/*.test.{ts,tsx}',
                '**/*.spec.{ts,tsx}'
            ],
            thresholds: {
                lines: 60,
                functions: 60,
                branches: 60,
                statements: 60
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

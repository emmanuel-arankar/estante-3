import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente (ex: .env, .env.local)
  const env = loadEnv(mode, process.cwd());

  // Define o target da API baseado nas configurações
  const useProdApi = env.VITE_USE_PROD_API === 'true';
  const useFirebaseEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';

  let apiTarget: string;
  let apiMode: string;

  if (useProdApi && !useFirebaseEmulators) {
    // Modo 1: Tudo em produção
    apiTarget = 'https://us-central1-estante-virtual-805ef.cloudfunctions.net/api';
    apiMode = 'PRODUÇÃO COMPLETA';
  } else if (!useProdApi && useFirebaseEmulators) {
    // Modo 2: Tudo em emuladores locais
    apiTarget = 'http://127.0.0.1:5001/estante-virtual-805ef/us-central1/api';
    apiMode = 'EMULADORES LOCAIS';
  } else {
    // Modo 3: HÍBRIDO - Backend API local standalone + Firebase produção
    apiTarget = 'http://127.0.0.1:3000';
    apiMode = 'HÍBRIDO (API Local + Firebase Produção)';
  }

  console.log(`🚀 API Proxy Target: ${apiTarget}`);
  console.log(`📍 Modo: ${apiMode}`);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

        manifest: {
          name: 'Estante de Bolso',
          short_name: 'Estante',
          description: 'Sua rede social de leitura - compartilhe livros e resenhas',
          theme_color: '#10b981', // emerald-600
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ],
          categories: ['books', 'social', 'lifestyle']
        },

        workbox: {
          runtimeCaching: [
            {
              // Cache Firebase Storage images
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'firebase-images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Cache API calls com NetworkFirst
              urlPattern: /^https:\/\/.*\.cloudfunctions\.net\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5 // 5 minutos
                },
                networkTimeoutSeconds: 10
              }
            }
          ]
        },

        devOptions: {
          enabled: true, // PWA em desenvolvimento também
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          // Rewrite apenas para Firebase Functions (emulador/produção), não para standalone
          rewrite: (!useProdApi && useFirebaseEmulators) || (useProdApi && !useFirebaseEmulators)
            ? (path) => path.replace(/^\/api/, '')
            : undefined,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - separados para melhor caching
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'ui-vendor': ['framer-motion', 'lucide-react'],
            'query-vendor': ['@tanstack/react-query'],
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      target: 'es2020',
      minify: 'esbuild', // esbuild é mais rápido e confiável
      sourcemap: false
    },
  };
});
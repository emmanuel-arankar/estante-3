import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
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
    plugins: [react()],
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
  };
});
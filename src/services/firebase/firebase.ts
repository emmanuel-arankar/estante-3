import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

// Funções de conexão com emuladores
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

// Inicializa o app
export const app = initializeApp(firebaseConfig);

// Exporta os serviços já inicializados
export const auth = getAuth(app);
export const storage = getStorage(app);
export const database = getDatabase(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Conecta aos emuladores locais APENAS se VITE_USE_FIREBASE_EMULATORS=true
const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const useProdApi = import.meta.env.VITE_USE_PROD_API === 'true';

if (import.meta.env.DEV && useFirebaseEmulators) {
    try {
        console.log("🛠️ Ambiente de DEV: Conectando aos emuladores locais do Firebase...");

        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        connectStorageEmulator(storage, "127.0.0.1", 9199);

        if (database) {
            connectDatabaseEmulator(database, "127.0.0.1", 9000);
        }

        console.log("✅ Conectado aos emuladores locais do Firebase.");
    } catch (error) {
        console.error("Falha ao conectar aos emuladores:", error);
    }
} else if (import.meta.env.DEV) {
    // Modo híbrido ou produção
    if (!useProdApi) {
        console.log("🔧 Ambiente de DEV: Modo HÍBRIDO (Backend API Local + Firebase Produção)");
    } else {
        console.log("🚀 Ambiente de DEV: Usando serviços de PRODUÇÃO (Nuvem)");
    }
}

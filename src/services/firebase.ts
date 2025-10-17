import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

// Funções de conexão com emuladores
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
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
export const db = getFirestore(app);
export const storage = getStorage(app);
export const database = getDatabase(app);
export const functions = getFunctions(app); // Adicionado para consistência
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Conecta aos emuladores locais em ambiente de desenvolvimento
if (import.meta.env.DEV && !import.meta.env.VITE_USE_PROD_AUTH) {
  try {
    console.log("Conectando aos emuladores locais do Firebase...");

    // # ATUALIZADO:
    // A documentação do Firebase v9+ mostra que, para o Auth, não é necessário
    // incluir o protocolo 'http://'. Vamos remover para garantir compatibilidade.
    // E garantir que a conexão com o Realtime Database também seja feita.
    //connectAuthEmulator(auth, "http://127.0.0.1:9099");
    //connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);

    // # ATUALIZADO: Adicionar a conexão com o Realtime Database Emulator, já que você o utiliza.
    // Verifique no seu terminal se a porta é 9000.
    if (database) {
      connectDatabaseEmulator(database, "127.0.0.1", 9000);
    }

    console.log("✅ Conectado aos emuladores.");
  } catch (error) {
    console.error("Falha ao conectar aos emuladores:", error);
  }
}
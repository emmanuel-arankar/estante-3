import * as logger from 'firebase-functions/logger';
export { requestTranscription } from './requestTranscription';
export * from './friendshipTriggers';
export * from './blockingTriggers';

// Conecta o Admin SDK aos emuladores se estiver em ambiente local
if (process.env.FUNCTIONS_EMULATOR) {
  logger.info("Conectando o Cloud Functions aos emuladores locais do Firebase...");

  // Definindo variáveis de ambiente para conectar aos emuladores
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

  logger.info("Variáveis de ambiente dos emuladores definidas para Cloud Functions.", {
    auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    firestore: process.env.FIRESTORE_EMULATOR_HOST,
    storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST
  });
  logger.info("✅ Conectado o Cloud Functions aos emuladores.");
} else {
  logger.info("Rodando Cloud Functions em ambiente de produção ou sem emuladores definidos.");
}

// Conecta o Admin SDK aos emuladores se estiver em ambiente local
if (process.env.FUNCTIONS_EMULATOR) {
 console.log("Conectando o Cloud Functions aos emuladores locais do Firebase...");

  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

  console.log("✅ Conectado o Cloud Functions aos emuladores.");
}
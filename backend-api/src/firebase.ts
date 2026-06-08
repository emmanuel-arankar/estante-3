// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import * as path from 'path';

/**
 * @name Gestão de Ambiente
 * @summary Configuração de Emuladores vs Produção.
 */
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  logger.info('Emulator detectado, removendo variáveis de ambiente do emulador para backend-api');

  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

  logger.info('Variáveis de ambiente do emulador removidas.');
} else {
  logger.info('Rodando em ambiente de produção ou sem emuladores definidos para backend-api.');
}

/**
 * @name Inicialização do Admin SDK
 * @summary Configura e inicializa o Firebase Admin SDK.
 */
if (admin.apps.length === 0) {
  const fs = require('fs');
  const saPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');

  const isManagedCloud = !!process.env.K_SERVICE || !!process.env.FUNCTION_NAME || !!process.env.FIREBASE_CONFIG;
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  if (fs.existsSync(saPath) && (!isManagedCloud || isEmulator)) {
    try {
      const credential = admin.credential.cert(require(saPath));
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463';

      admin.initializeApp({
        projectId,
        credential,
        databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`
      });
      logger.info('Firebase Admin inicializado com Service Account EXPLÍCITA.');
    } catch (e) {
      logger.error('Falha ao carregar credenciais locais. Usando ADC.', e);
      admin.initializeApp();
    }
  } else {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463';
    // Se estiver em teste, evitamos falha se databaseURL estiver faltando
    const databaseURL = process.env.FIREBASE_DATABASE_URL || (process.env.NODE_ENV === 'test' ? 'https://mock.firebaseio.com' : `https://${projectId}-default-rtdb.firebaseio.com`);

    admin.initializeApp({
      projectId,
      databaseURL
    });
    logger.info('Firebase Admin inicializado em modo GERENCIADO (ADC).');
  }
}

export const db = admin.firestore();
export const rtdb = admin.database();
export const bucket = admin.storage().bucket(`${process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463'}.firebasestorage.app`);
export const auth = admin.auth();

export { admin };

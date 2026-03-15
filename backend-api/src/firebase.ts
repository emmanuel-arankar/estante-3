// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import * as path from 'path';

/**
 * @name Gestão de Ambiente
 * @summary Configuração de Emuladores vs Produção.
 * @description Detecta se o backend está rodando no Firebase Emulator Suite. 
 * Em contextos específicos da `backend-api`, variáveis de redirecionamento do emulador 
 * podem ser removidas para forçar a conexão com serviços de nuvem reais mesmo durante o desenvolvimento local.
 * 
 * @note Lógica de Redirecionamento:
 * - Se `FUNCTIONS_EMULATOR` for true, o script limpa os hosts de Auth, Firestore e Storage do ambiente.
 * - Isso é útil quando a API precisa interagir com dados reais fora do ambiente isolado do emulador.
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
 * @description Garante que o SDK seja inicializado apenas uma vez, lidando com diferentes ambientes:
 * 1. **Standalone**: Execução fora do Cloud Functions, exigindo Service Account ou ADC.
 * 2. **Cloud Functions**: Inicialização automática via ambiente gerenciado do Firebase.
 * 
 * @example
 * import { admin } from './firebase';
 * 
 * @note Fluxo de Credenciais (Standalone):
 * - Tenta carregar o caminho do JSON definido em `GOOGLE_APPLICATION_CREDENTIALS`.
 * - Caso falhe, recorre ao Application Default Credentials (ADC).
 */
if (admin.apps.length === 0) {
  const fs = require('fs');
  const saPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');

  // Se estamos no Cloud Run / Functions V2, ou Cloud Functions G1, as variáveis de gerência estarão ativas.
  const isManagedCloud = !!process.env.K_SERVICE || !!process.env.FUNCTION_NAME || !!process.env.FIREBASE_CONFIG;
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

  // Usar JSON apenas localmente ou explícito pelo emulador (ignora se estiver fisicamente na nuvem para usar ADC nativo do Compute Engine)
  if (fs.existsSync(saPath) && (!isManagedCloud || isEmulator)) {
    try {
      const credential = admin.credential.cert(require(saPath));
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463';

      admin.initializeApp({
        projectId,
        credential,
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
      });
      logger.info('Firebase Admin inicializado com Service Account EXPLÍCITA (Permissões Totais).');
    } catch (e) {
      logger.error('Falha ao carregar credenciais locais. Usando ADC.', e);
      admin.initializeApp();
    }
  } else {
    // Recurso ao Application Default Credentials (ADC) em ambientes cloud
    // No ambiente de teste/CI, precisamos garantir o projectId e databaseURL
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463';
    admin.initializeApp({
      projectId,
      databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`
    });
    logger.info('Firebase Admin inicializado em modo GERENCIADO (ADC).');
  }
}

/**
 * @name Instância do Firestore
 * @summary Acesso global ao banco de dados Firestore.
 */
export const db = admin.firestore();

/**
 * @name Instância do Realtime Database
 * @summary Acesso global ao banco de dados em tempo real.
 */
export const rtdb = admin.database();

/**
 * @name Instância do Storage
 * @summary Acesso ao bucket padrão do Firebase Storage.
 */
export const bucket = admin.storage().bucket(`${process.env.VITE_FIREBASE_PROJECT_ID || 'estante-75463'}.firebasestorage.app`);

/**
 * @name Instância do Auth
 * @summary Acesso global à autenticação Firebase.
 */
export const auth = admin.auth();

export { admin };

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
  const isStandalone = !process.env.FUNCTIONS_EMULATOR && !process.env.FIREBASE_CONFIG;

  if (isStandalone) {
    // ==== ==== 1. AMBIENTE STANDALONE (LOCAL/CI) ==== ====
    let credential;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Prioridade: Service Account via JSON resolvida de forma absoluta
        const credentialPath = path.resolve(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        credential = admin.credential.cert(require(credentialPath));
        logger.info(`Credentials: Service Account carregado de ${credentialPath}`);
      } catch (error) {
        logger.warn(`Fallback: Falha no Service Account. Tentando ADC.`);
        credential = admin.credential.applicationDefault();
      }
    } else {
      // Recurso ao Application Default Credentials (ADC) em ambientes cloud ou locais configurados
      logger.info('Usando Application Default Credentials (ADC)');
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
      projectId: 'estante-virtual-805ef',
      credential: credential,
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    logger.info('Firebase Admin inicializado em modo STANDALONE.');
  } else {
    // ==== ==== 2. AMBIENTE GERENCIADO (CLOUD FUNCTIONS) ==== ====
    admin.initializeApp();
    logger.info('Firebase Admin inicializado em modo GERENCIADO.');
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
export const bucket = admin.storage().bucket('estante-virtual-805ef.firebasestorage.app');

/**
 * @name Instância do Auth
 * @summary Acesso global à autenticação Firebase.
 */
export const auth = admin.auth();

export { admin };

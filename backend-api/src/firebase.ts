import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import * as path from 'path';

// Configuração de ambiente para Emulador vs Produção
if (process.env.FUNCTIONS_EMULATOR === 'true') {
    logger.info('Emulator detectado, removendo variáveis de ambiente do emulador para backend-api');

    // Se o usuário quer usar banco de produção mesmo no emulador,
    // essas variáveis devem ser removidas para forçar uso das credenciais default/Google
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

    logger.info('Variáveis de ambiente do emulador removidas.');
} else {
    logger.info('Rodando em ambiente de produção ou sem emuladores definidos para backend-api.');
}

// Inicializa o Firebase Admin se ainda não estiver inicializado
if (admin.apps.length === 0) {
    // Se estiver rodando localmente (standalone), precisa de credenciais
    const isStandalone = !process.env.FUNCTIONS_EMULATOR && !process.env.FIREBASE_CONFIG;

    if (isStandalone) {
        let credential;

        // Tenta usar service account do .env
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            try {
                const credentialPath = path.resolve(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
                credential = admin.credential.cert(require(credentialPath));
                logger.info(`Service Account carregado de: ${credentialPath}`);
            } catch (error) {
                logger.warn(`Falha ao carregar service account: ${error}`);
                logger.info('Tentando usar Application Default Credentials...');
                credential = admin.credential.applicationDefault();
            }
        } else {
            logger.info('GOOGLE_APPLICATION_CREDENTIALS não definido, usando Application Default Credentials');
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            projectId: 'estante-virtual-805ef',
            credential: credential,
        });
        logger.info('Firebase Admin inicializado em modo STANDALONE com credenciais.');
    } else {
        admin.initializeApp();
        logger.info('Firebase Admin inicializado com sucesso.');
    }
}

export const db = admin.firestore();
export const auth = admin.auth();
export { admin };

/**
 * SCRIPT DE MIGRAÇÃO: Copiar dados entre projetos Firebase
 *
 * @description Copia coleções específicas do projeto Antigo para o Novo.
 *
 * @usage
 *   cd backend-api
 *   npx ts-node scripts/migrate-to-new-project.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Coleções para migrar
const COLLECTIONS_TO_MIGRATE = ['users', 'books', 'friendships', 'notifications', 'searchTerms'];

const oldCredPath = path.resolve(__dirname, '..', 'oldServiceAccountKey.json');
const newCredPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');

// Função para carregar JSON e tratar a chave privada PEM
const loadConfig = (filePath: string) => {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (config.private_key) {
        config.private_key = config.private_key.replace(/\\n/g, '\n');
    }
    return config;
};

// Inicializar App Antigo (Fonte)
const oldApp = admin.initializeApp({
    credential: admin.credential.cert(loadConfig(oldCredPath)),
    projectId: 'estante-75463'
}, 'old-project');

// Inicializar App Novo (Destino)
const newApp = admin.initializeApp({
    credential: admin.credential.cert(loadConfig(newCredPath)),
    projectId: 'estante-75463'
}, 'new-project');

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

const BATCH_SIZE = 500;

async function migrateCollection(collectionName: string) {
    console.log(`\n📦 Migrando coleção: ${collectionName}...`);
    let totalMigrated = 0;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    while (true) {
        let query = oldDb.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = newDb.batch();
        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            batch.set(newDb.collection(collectionName).doc(doc.id), data);
            totalMigrated++;
        });

        await batch.commit();
        console.log(`  ✅ ${totalMigrated} documentos migrados...`);
        lastDoc = snapshot.docs[snapshot.docs.length - 1] as admin.firestore.QueryDocumentSnapshot;
    }
    console.log(`✨ Coleção ${collectionName} finalizada: ${totalMigrated} docs.`);
}

async function startMigration() {
    console.log('🚀 Iniciando Migração de Dados...');
    console.log('Fonte: estante-75463');
    console.log('Destino: estante-75463');
    console.log('='.repeat(40));

    for (const collection of COLLECTIONS_TO_MIGRATE) {
        try {
            await migrateCollection(collection);
        } catch (error) {
            console.error(`❌ Erro ao migrar ${collection}:`, error);
        }
    }

    console.log('\n' + '='.repeat(40));
    console.log('✅ Migração finalizada com sucesso!');
}

startMigration()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro fatal:', err);
        process.exit(1);
    });

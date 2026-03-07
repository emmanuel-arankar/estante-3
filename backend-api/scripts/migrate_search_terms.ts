import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { generateSearchTerms } from '../src/lib/search';

// Carregar variáveis de ambiente (para acessar emuladores se necessário)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Inicializar Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'estante-3',
    });
}

const db = admin.firestore();

async function migrateUsers() {
    console.log('\n--- INICIANDO MIGRAÇÃO: USERS ---');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Encontrados ${usersSnapshot.size} usuários.`);

    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opCount = 0;
    let updatedCount = 0;

    for (const doc of usersSnapshot.docs) {
        const data = doc.data();
        const searchTerms = generateSearchTerms(data.displayName || '', data.nickname || '');

        if (searchTerms.length > 0) {
            currentBatch.update(doc.ref, { searchTerms });
            opCount++;
            updatedCount++;

            if (opCount >= 499) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                opCount = 0;
            }
        }
    }

    if (opCount > 0) {
        batches.push(currentBatch);
    }

    console.log(`Aplicando ${batches.length} lote(s) para usuários...`);
    await Promise.all(batches.map(b => b.commit()));
    console.log(`Migração USERS concluída. ${updatedCount} usuários atualizados.`);
}

async function migrateFriendships() {
    console.log('\n--- INICIANDO MIGRAÇÃO: FRIENDSHIPS ---');
    const friendshipsSnapshot = await db.collection('friendships').get();
    console.log(`Encontradas ${friendshipsSnapshot.size} amizades/solicitações.`);

    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opCount = 0;
    let updatedCount = 0;

    for (const doc of friendshipsSnapshot.docs) {
        const data = doc.data();
        if (data.friend) {
            const searchTerms = generateSearchTerms(data.friend.displayName || '', data.friend.nickname || '');

            if (searchTerms.length > 0) {
                currentBatch.update(doc.ref, { 'friend.searchTerms': searchTerms });
                opCount++;
                updatedCount++;

                if (opCount >= 499) {
                    batches.push(currentBatch);
                    currentBatch = db.batch();
                    opCount = 0;
                }
            }
        }
    }

    if (opCount > 0) {
        batches.push(currentBatch);
    }

    console.log(`Aplicando ${batches.length} lote(s) para amizades...`);
    await Promise.all(batches.map(b => b.commit()));
    console.log(`Migração FRIENDSHIPS concluída. ${updatedCount} documentos atualizados.`);
}

async function run() {
    try {
        await migrateUsers();
        await migrateFriendships();
        console.log('\n✅ MIGRAÇÃO COMPLETA COM SUCESSO!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRO NA MIGRAÇÃO:', error);
        process.exit(1);
    }
}

run();

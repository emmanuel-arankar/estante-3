/**
 * =============================================================================
 * SCRIPT DE MIGRAÇÃO: Popular campo searchTerms
 * =============================================================================
 *
 * @description Popula o campo `searchTerms` em todos os documentos da coleção
 * `users` que ainda não possuem esse campo.
 *
 * @usage
 *   cd backend-api
 *   npx ts-node scripts/migrate-search-terms.ts            # execução real
 *   npx ts-node scripts/migrate-search-terms.ts --dry-run   # apenas mostra
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// =============================================================================
// INICIALIZAÇÃO (mínima, apenas Firestore)
// =============================================================================

if (admin.apps.length === 0) {
    // FORÇANDO EMULADOR LOCAL PARA NÃO BATER NA PRODUÇÃO ONDE SOMOS LEITORES
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

    let credential;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            const credentialPath = path.resolve(__dirname, '..', process.env.GOOGLE_APPLICATION_CREDENTIALS);
            credential = admin.credential.cert(require(credentialPath));
            console.log(`✅ Credenciais carregadas de: ${credentialPath}`);
        } catch {
            credential = admin.credential.applicationDefault();
            console.log('⚠️ Fallback para Application Default Credentials');
        }
    } else {
        credential = admin.credential.applicationDefault();
        console.log('ℹ️ Usando Application Default Credentials');
    }

    admin.initializeApp({
        projectId: 'estante-75463',
        credential,
    });
}

const db = admin.firestore();

// =============================================================================
// LÓGICA DE GERAÇÃO DE TERMOS (mesma do users.ts)
// =============================================================================

const generateSearchTerms = (...fields: (string | undefined | null)[]): string[] => {
    const terms = new Set<string>();

    for (const field of fields) {
        if (!field || typeof field !== 'string') continue;

        const normalized = field
            .toLowerCase()
            .normalize('NFD') // Decompõe os acentos
            .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
            .trim();

        if (!normalized) continue;

        terms.add(normalized);

        for (let i = 1; i <= normalized.length; i++) {
            terms.add(normalized.substring(0, i));
        }

        const words = normalized.split(/\s+/);
        if (words.length > 1) {
            for (const word of words) {
                if (!word) continue;
                terms.add(word);
                for (let i = 1; i <= word.length; i++) {
                    terms.add(word.substring(0, i));
                }
            }
        }
    }
    return Array.from(terms).filter(term => term.length > 0);
};

// =============================================================================
// MIGRAÇÃO
// =============================================================================

const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
    console.log('='.repeat(60));
    console.log('MIGRAÇÃO: Popular campo searchTerms');
    console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (sem escrita)' : '🚀 EXECUÇÃO REAL'}`);
    console.log('='.repeat(60));

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    const startTime = Date.now();

    while (true) {
        let query = db.collection('users')
            .orderBy('__name__')
            .limit(BATCH_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            console.log('\n✅ Todos os documentos processados!');
            break;
        }

        const batch = db.batch();
        let batchUpdates = 0;

        for (const doc of snapshot.docs) {
            totalProcessed++;
            const data = doc.data();

            if (data.searchTerms && Array.isArray(data.searchTerms) && data.searchTerms.length > 0) {
                totalSkipped++;
                continue;
            }

            const displayName = data.displayName || '';
            const nickname = data.nickname || '';

            if (!displayName && !nickname) {
                totalSkipped++;
                continue;
            }

            try {
                const searchTerms = generateSearchTerms(displayName, nickname);

                if (searchTerms.length > 0) {
                    if (!DRY_RUN) {
                        batch.update(doc.ref, { searchTerms });
                    }
                    batchUpdates++;
                    totalUpdated++;

                    if (totalUpdated <= 10) {
                        console.log(`  📝 ${doc.id}: "${displayName}" (@${nickname}) → ${searchTerms.length} termos`);
                    }
                }
            } catch (error) {
                totalErrors++;
                console.error(`  ❌ Erro no doc ${doc.id}:`, error);
            }
        }

        if (batchUpdates > 0 && !DRY_RUN) {
            await batch.commit();
        }

        console.log(`  Batch: ${snapshot.size} docs, ${batchUpdates} atualizados`);
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('RELATÓRIO FINAL');
    console.log('='.repeat(60));
    console.log(`  📊 Total processados: ${totalProcessed}`);
    console.log(`  ✅ Atualizados:       ${totalUpdated}`);
    console.log(`  ⏭️  Pulados:           ${totalSkipped}`);
    console.log(`  ❌ Erros:             ${totalErrors}`);
    console.log(`  ⏱️  Tempo:             ${duration}s`);
    if (DRY_RUN) {
        console.log('\n⚠️  DRY-RUN: nenhuma escrita foi feita.');
    }
    console.log('='.repeat(60));
}

migrate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });

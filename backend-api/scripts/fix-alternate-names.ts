import { db, admin } from '../src/firebase';

async function migrate() {
    console.log('🚀 Iniciando migração: alternativeNames -> alternateNames...');

    const collections = ['persons', 'works', 'editions', 'publishers', 'series'];

    for (const colName of collections) {
        console.log(`\n📂 Processando coleção: ${colName}...`);
        const snapshot = await db.collection(colName).get();
        
        if (snapshot.empty) {
            console.log(`   ⚠️ Coleção ${colName} está vazia.`);
            continue;
        }

        let count = 0;
        let batch = db.batch();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Verifica se o campo errado existe
            if (data.alternativeNames !== undefined) {
                console.log(`      📝 Corrigindo: ${data.name || data.title || doc.id}`);
                
                batch.update(doc.ref, {
                    alternateNames: data.alternativeNames,
                    alternativeNames: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                count++;

                // Commit a cada 400 docs (limite do Firestore é 500)
                if (count > 0 && count % 400 === 0) {
                    await batch.commit();
                    batch = db.batch();
                    console.log(`   ✅ Batch commit: ${count} documentos processados...`);
                }
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }
        
        console.log(`   ✨ Finalizado ${colName}: ${count} docs corrigidos.`);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Erro durante a migração:', err);
    process.exit(1);
});

import { db } from '../src/firebase';
import { generateSearchTerms } from '../src/lib/search';

async function rebuild() {
    console.log('🚀 Iniciando rebuild de searchTerms...');

    const collections = [
        { name: 'persons', fields: ['name', 'alternateNames'] },
        { name: 'authorGroups', fields: ['name'] },
        { name: 'works', fields: ['title', 'subtitle', 'originalTitle', 'alternateNames'] },
        { name: 'editions', fields: ['title', 'subtitle', 'isbn13', 'isbn10', 'asin'] },
        { name: 'publishers', fields: ['name', 'alternateNames'] },
        { name: 'series', fields: ['name', 'alternateNames'] }
    ];

    for (const colDef of collections) {
        console.log(`\n📂 Processando coleção: ${colDef.name}...`);
        const snapshot = await db.collection(colDef.name).get();
        
        if (snapshot.empty) {
            console.log(`   ⚠️ Coleção ${colDef.name} está vazia.`);
            continue;
        }

        let count = 0;
        let batch = db.batch();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const terms: (string | undefined | null)[] = [];
            colDef.fields.forEach(field => {
                const val = data[field];
                if (Array.isArray(val)) {
                    // Trata alternateNames que pode ser array de strings ou array de objetos { value: string }
                    if (field === 'alternateNames') {
                        val.forEach((alt: unknown) => {
                            const altVal = alt as Record<string, unknown> | string; if (typeof altVal === 'string') terms.push(altVal);
                            else if (altVal && typeof altVal.value === 'string') terms.push(altVal.value as string);
                        });
                    }
                } else if (typeof val === 'string') {
                    terms.push(val);
                }
            });

            const newSearchTerms = generateSearchTerms(...terms);
            
            // Removendo a comparação JSON para forçar a atualização de todos os registros
            // Isso garante que mudanças na lógica do generateSearchTerms ou campos novos sejam refletidos.
            console.log(`      📝 Atualizando: ${data.name || data.title || doc.id}`);
            batch.update(doc.ref, { 
                searchTerms: newSearchTerms,
                updatedAt: new Date()
            });
            count++;

            // Commit a cada 400 docs (limite do Firestore é 500)
            if (count > 0 && count % 400 === 0) {
                await batch.commit();
                batch = db.batch();
                console.log(`   ✅ Batch commit: ${count} documentos processados...`);
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }
        
        console.log(`   ✨ Finalizado ${colDef.name}: ${count} docs atualizados de ${snapshot.size}.`);
    }

    console.log('\n✅ Rebuild concluído com sucesso!');
    process.exit(0);
}

rebuild().catch(err => {
    console.error('❌ Erro durante o rebuild:', err);
    process.exit(1);
});

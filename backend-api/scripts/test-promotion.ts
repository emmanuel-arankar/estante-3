import { db, admin } from '../src/firebase';
import { generateSearchTerms } from '../src/lib/search';

async function testPromotion() {
    const timestamp = admin.firestore.Timestamp.now();
    const testSuggestionId = 'test_suggestion_' + Date.now();
    
    console.log(`🚀 Iniciando teste de promoção: ${testSuggestionId}`);

    try {
        // 1. Criar uma sugestão fake de Pessoa
        const suggestionData = {
            type: 'person',
            status: 'pending',
            suggestedBy: 'test_user_id',
            suggestedByName: 'Test User',
            createdAt: timestamp,
            data: {
                name: 'Autor de Teste Antigravity ' + Date.now(),
                bio: 'Bio de teste para verificação de persistência.',
                nationality: 'BR'
            }
        };

        await db.collection('contentSuggestions').doc(testSuggestionId).set(suggestionData);
        console.log('✅ Sugestão de teste criada.');

        // 2. Simular a lógica de promoção que adicionei no curatorship.ts
        // (Em vez de chamar a API, vou executar a lógica aqui para ver se o Firestore aceita o objeto)
        const finalData = suggestionData.data;
        const searchTerms = generateSearchTerms(
            finalData.name
        );

        const entityToCreate = {
            ...finalData,
            searchTerms,
            createdBy: suggestionData.suggestedBy,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        console.log('📝 Tentando criar entidade:', JSON.stringify(entityToCreate, null, 2));
        
        const docRef = await db.collection('persons').add(entityToCreate);
        console.log(`✨ Entidade criada com sucesso! ID: ${docRef.id}`);

        // 3. Verificar o status da sugestão
        await db.collection('contentSuggestions').doc(testSuggestionId).update({
            status: 'approved',
            createdEntityId: docRef.id,
            resolvedAt: timestamp
        });
        console.log('📈 Status da sugestão atualizado para aprovado.');

        // 4. Limpar (opcional) - Vou deixar por enquanto para eu ver no Firestore se quiser
        console.log(`\n🔍 Verifique o Autor no Firestore com ID: ${docRef.id}`);

    } catch (error) {
        console.error('❌ Erro no teste de promoção:', error);
        process.exit(1);
    }
    process.exit(0);
}

testPromotion();

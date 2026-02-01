
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente do .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Script para rodar com tsx
// Uso: npx tsx scripts/migrate-friend-counts.ts

async function migrateFriendCounts() {
    console.log('🚀 Iniciando migração de contadores de amigos...\n');

    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);

    const totalUsers = usersSnapshot.size;
    let processed = 0;
    let updated = 0;
    let errors = 0;

    console.log(`Encontrados ${totalUsers} usuários para processar.`);

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        processed++;

        try {
            // Contar amigos aceitos
            const friendsQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', userId),
                where('status', '==', 'accepted')
            );
            const friendsSnapshot = await getDocs(friendsQuery);
            const friendsCount = friendsSnapshot.size;

            // Contar solicitações recebidas
            const requestsQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', userId),
                where('status', '==', 'pending'),
                where('requestedBy', '!=', userId)
            );
            const requestsSnapshot = await getDocs(requestsQuery);
            const pendingRequestsCount = requestsSnapshot.size;

            // Contar solicitações enviadas
            const sentQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', userId),
                where('status', '==', 'pending'),
                where('requestedBy', '==', userId)
            );
            const sentSnapshot = await getDocs(sentQuery);
            const sentRequestsCount = sentSnapshot.size;

            // Atualizar documento do usuário
            await updateDoc(doc(db, 'users', userId), {
                friendsCount,
                pendingRequestsCount,
                sentRequestsCount
            });

            updated++;
            if (processed % 10 === 0) {
                console.log(`✅ [${processed}/${totalUsers}] ${userId}: ${friendsCount} amigos`);
            }
        } catch (error) {
            errors++;
            console.error(`❌ [${processed}/${totalUsers}] Erro ao processar ${userId}:`, error);
        }
    }

    console.log('\n📊 Migração concluída!');
    console.log(`   Total de usuários: ${totalUsers}`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Erros: ${errors}`);
}

migrateFriendCounts()
    .then(() => {
        console.log('\n🎉 Script finalizado com sucesso!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

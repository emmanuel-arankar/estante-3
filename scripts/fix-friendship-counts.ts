import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, getCountFromServer } from 'firebase/firestore';
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

async function fixFriendshipCounts() {
    console.log('🚀 Iniciando reparo de contadores de amizade...\n');

    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);

    const totalUsers = usersSnapshot.size;
    let updatedCount = 0;
    let errorCount = 0;

    console.log(`Analisando ${totalUsers} usuários...`);

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const userName = userData.displayName || 'Sem nome';

        try {
            // 1. Contar amigos (accepted)
            const friendsQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', userId),
                where('status', '==', 'accepted')
            );
            const friendsSnapshot = await getCountFromServer(friendsQuery);
            const realFriendsCount = friendsSnapshot.data().count;

            // 2. Contar solicitações recebidas (pending + requestedBy != userId)
            const pendingQuery = query(
                collection(db, 'friendships'),
                where('userId', '==', userId),
                where('status', '==', 'pending')
            );
            // Infelizmente count() não suporta filtros complexos client-side pós-query sem baixar docs se não tiver índice composto perfeito as vezes
            // Mas 'pending' filtra tudo. Vamos baixar os docs de pending pra filtrar 'requestedBy' em memória
            // Pending requests geralmente são poucas, então ok baixar.
            const pendingDocs = await getDocs(pendingQuery);
            let realPendingCount = 0;
            let realSentCount = 0;

            pendingDocs.forEach(doc => {
                const data = doc.data();
                if (data.requestedBy === userId) {
                    realSentCount++;
                } else {
                    realPendingCount++;
                }
            });

            // Comparar com dados atuais
            const currentFriends = userData.friendsCount || 0;
            const currentPending = userData.pendingRequestsCount || 0;
            const currentSent = userData.sentRequestsCount || 0;

            if (currentFriends !== realFriendsCount ||
                currentPending !== realPendingCount ||
                currentSent !== realSentCount) {

                console.log(`🔧 Corrigindo ${userName} (${userId}):`);
                console.log(`   Friends: ${currentFriends} -> ${realFriendsCount}`);
                console.log(`   Pending: ${currentPending} -> ${realPendingCount}`);
                console.log(`   Sent:    ${currentSent} -> ${realSentCount}`);

                await updateDoc(doc(db, 'users', userId), {
                    friendsCount: realFriendsCount,
                    pendingRequestsCount: realPendingCount,
                    sentRequestsCount: realSentCount,
                    updatedAt: new Date() // Timestamp JS normal, o SDK converte
                });

                updatedCount++;
            }

        } catch (error) {
            console.error(`❌ Erro ao processar usuário ${userId}:`, error);
            errorCount++;
        }
    }

    console.log('\n📊 Resumo do Reparo:');
    console.log(`   Total analisado: ${totalUsers}`);
    console.log(`   Usuários corrigidos: ${updatedCount}`);
    console.log(`   Erros: ${errorCount}`);
}

fixFriendshipCounts()
    .then(() => {
        console.log('\n🎉 Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

/**
 * Script para adicionar contadores de amigos em comum às solicitações pendentes
 *
 * Este script:
 * 1. Busca todas as amizades com status 'pending'
 * 2. Calcula quantos amigos em comum cada par de usuários tem
 * 3. Atualiza ambos os documentos (do solicitante e do destinatário) com o contador
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Erro: Variáveis de ambiente do Firebase não encontradas!');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DRY_RUN = false; // Mude para true para simular

/**
 * Calcula quantos amigos em comum dois usuários têm
 */
async function calculateMutualFriendsCount(userId1: string, userId2: string): Promise<number> {
  try {
    // Buscar amigos de ambos os usuários
    const [user1FriendsQuery, user2FriendsQuery] = await Promise.all([
      getDocs(query(
        collection(db, 'friendships'),
        where('userId', '==', userId1),
        where('status', '==', 'accepted')
      )),
      getDocs(query(
        collection(db, 'friendships'),
        where('userId', '==', userId2),
        where('status', '==', 'accepted')
      ))
    ]);

    // Criar sets com os IDs dos amigos
    const user1Friends = new Set(user1FriendsQuery.docs.map(doc => doc.data().friendId));
    const user2Friends = new Set(user2FriendsQuery.docs.map(doc => doc.data().friendId));

    // Contar interseção
    let mutualCount = 0;
    user1Friends.forEach(friendId => {
      if (user2Friends.has(friendId)) {
        mutualCount++;
      }
    });

    return mutualCount;
  } catch (error) {
    console.error('Erro ao calcular amigos em comum:', error);
    return 0;
  }
}

async function addMutualFriendsToPending() {
  console.log('🚀 Iniciando migração de amigos em comum...\n');
  console.log(`📝 Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}\n`);

  try {
    // 1. Buscar todas as amizades pendentes
    console.log('📊 Buscando solicitações pendentes...');
    const pendingQuery = query(
      collection(db, 'friendships'),
      where('status', '==', 'pending')
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    console.log(`✅ Encontradas ${pendingSnapshot.docs.length} solicitações pendentes\n`);

    // 2. Agrupar por pares únicos (evitar processar o mesmo par duas vezes)
    const processedPairs = new Set<string>();
    const pairs: Array<{ userId: string; friendId: string; docs: Array<{ id: string; userId: string }> }> = [];

    pendingSnapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const userId = data.userId;
      const friendId = data.friendId;

      // Criar chave única para o par (ordenada alfabeticamente)
      const pairKey = [userId, friendId].sort().join('_');

      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);

        // Encontrar ambos os documentos deste par
        const pairDocs = pendingSnapshot.docs
          .filter(d => {
            const dData = d.data();
            return (
              (dData.userId === userId && dData.friendId === friendId) ||
              (dData.userId === friendId && dData.friendId === userId)
            );
          })
          .map(d => ({ id: d.id, userId: d.data().userId }));

        pairs.push({ userId, friendId, docs: pairDocs });
      }
    });

    console.log(`📝 Encontrados ${pairs.length} pares únicos de usuários\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // 3. Processar cada par
    for (const pair of pairs) {
      try {
        const { userId, friendId, docs } = pair;

        // Calcular amigos em comum
        const mutualFriendsCount = await calculateMutualFriendsCount(userId, friendId);

        console.log(`👥 Par: ${userId.substring(0, 8)}... ↔ ${friendId.substring(0, 8)}...`);
        console.log(`   Amigos em comum: ${mutualFriendsCount}`);

        // Atualizar ambos os documentos do par
        if (!DRY_RUN) {
          for (const docInfo of docs) {
            const docRef = doc(db, 'friendships', docInfo.id);
            await updateDoc(docRef, {
              mutualFriendsCount,
              updatedAt: new Date()
            });
          }
          console.log(`   ✅ ${docs.length} documento(s) atualizado(s)\n`);
        } else {
          console.log(`   ⏭️  Simulação - ${docs.length} documento(s) seriam atualizados\n`);
        }

        updatedCount += docs.length;
        processedCount++;
      } catch (error) {
        console.error(`❌ Erro ao processar par:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(50));
    console.log(`Pares processados: ${processedCount}`);
    console.log(`Documentos atualizados: ${updatedCount}`);
    console.log(`Erros: ${errorCount}`);
    console.log('='.repeat(50));

    if (DRY_RUN) {
      console.log('\n⚠️  ATENÇÃO: Este foi um DRY RUN (simulação)');
      console.log('Para executar de verdade, mude DRY_RUN para false no script');
    } else {
      console.log('\n✅ Migração concluída com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro fatal durante a migração:', error);
    process.exit(1);
  }
}

// Executar
addMutualFriendsToPending()
  .then(() => {
    console.log('\n✨ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

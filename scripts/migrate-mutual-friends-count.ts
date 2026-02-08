/**
 * Script para migrar mutualFriendsCount e mutualFriendsPreview
 * para TODAS as amizades (pendentes e aceitas)
 *
 * Este script:
 * 1. Busca todas as amizades
 * 2. Agrupa por pares únicos
 * 3. Calcula amigos em comum para cada par
 * 4. Atualiza os documentos com count e preview (primeiros 3 IDs)
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  writeBatch
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

const DRY_RUN = false; // Mude para false para executar de verdade
const BATCH_SIZE = 500; // Limite do Firestore

interface MutualFriendsResult {
  count: number;
  preview: string[];
}

/**
 * Calcula amigos em comum entre dois usuários
 * Retorna count e preview (primeiros 3 IDs)
 */
async function calculateMutualFriends(userId1: string, userId2: string): Promise<MutualFriendsResult> {
  try {
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

    const user1Friends = new Set(user1FriendsQuery.docs.map(d => d.data().friendId));
    const mutualIds: string[] = [];

    for (const docSnapshot of user2FriendsQuery.docs) {
      const friendId = docSnapshot.data().friendId;
      if (user1Friends.has(friendId)) {
        mutualIds.push(friendId);
      }
    }

    return {
      count: mutualIds.length,
      preview: mutualIds.slice(0, 3)
    };
  } catch (error) {
    console.error('Erro ao calcular amigos em comum:', error);
    return { count: 0, preview: [] };
  }
}

async function migrateMutualFriendsCount() {
  console.log('🚀 Iniciando migração de mutualFriendsCount...\n');
  console.log(`📝 Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}\n`);

  try {
    // 1. Buscar TODAS as amizades
    console.log('📊 Buscando todas as amizades...');
    const allFriendshipsSnapshot = await getDocs(collection(db, 'friendships'));
    console.log(`✅ Encontradas ${allFriendshipsSnapshot.docs.length} amizades\n`);

    // 2. Agrupar por pares únicos
    const processedPairs = new Set<string>();
    const pairs: Array<{
      userId: string;
      friendId: string;
      docIds: string[];
    }> = [];

    allFriendshipsSnapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const userId = data.userId;
      const friendId = data.friendId;

      // Criar chave única para o par (ordenada alfabeticamente)
      const pairKey = [userId, friendId].sort().join('_');

      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);

        // Encontrar ambos os documentos deste par
        const pairDocIds = allFriendshipsSnapshot.docs
          .filter(d => {
            const dData = d.data();
            return (
              (dData.userId === userId && dData.friendId === friendId) ||
              (dData.userId === friendId && dData.friendId === userId)
            );
          })
          .map(d => d.id);

        pairs.push({ userId, friendId, docIds: pairDocIds });
      }
    });

    console.log(`📝 Encontrados ${pairs.length} pares únicos de usuários\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let batchOps: Array<{ docId: string; data: MutualFriendsResult }> = [];

    // 3. Processar cada par
    for (const pair of pairs) {
      try {
        const { userId, friendId, docIds } = pair;

        // Calcular amigos em comum
        const mutualFriends = await calculateMutualFriends(userId, friendId);

        if (processedCount % 10 === 0 || mutualFriends.count > 0) {
          console.log(`👥 Par ${processedCount + 1}/${pairs.length}: ${userId.substring(0, 8)}... ↔ ${friendId.substring(0, 8)}...`);
          console.log(`   Amigos em comum: ${mutualFriends.count}`);
          if (mutualFriends.preview.length > 0) {
            console.log(`   Preview: [${mutualFriends.preview.map(id => id.substring(0, 8) + '...').join(', ')}]`);
          }
        }

        // Adicionar ao batch
        for (const docId of docIds) {
          batchOps.push({ docId, data: mutualFriends });
        }

        processedCount++;

        // Executar batch quando atingir o limite
        if (!DRY_RUN && batchOps.length >= BATCH_SIZE) {
          console.log(`\n📦 Executando batch de ${batchOps.length} operações...`);
          const batch = writeBatch(db);
          for (const op of batchOps) {
            const docRef = doc(db, 'friendships', op.docId);
            batch.update(docRef, {
              mutualFriendsCount: op.data.count,
              mutualFriendsPreview: op.data.preview,
              updatedAt: new Date()
            });
          }
          await batch.commit();
          updatedCount += batchOps.length;
          console.log(`✅ Batch concluído\n`);
          batchOps = [];
        }
      } catch (error) {
        console.error(`❌ Erro ao processar par:`, error);
        errorCount++;
      }
    }

    // Executar batch final
    if (!DRY_RUN && batchOps.length > 0) {
      console.log(`\n📦 Executando batch final de ${batchOps.length} operações...`);
      const batch = writeBatch(db);
      for (const op of batchOps) {
        const docRef = doc(db, 'friendships', op.docId);
        batch.update(docRef, {
          mutualFriendsCount: op.data.count,
          mutualFriendsPreview: op.data.preview,
          updatedAt: new Date()
        });
      }
      await batch.commit();
      updatedCount += batchOps.length;
      console.log(`✅ Batch final concluído\n`);
    }

    if (DRY_RUN) {
      updatedCount = batchOps.length + (processedCount * 2); // Estimativa
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(50));
    console.log(`Pares processados: ${processedCount}`);
    console.log(`Documentos ${DRY_RUN ? 'que seriam ' : ''}atualizados: ~${updatedCount}`);
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
migrateMutualFriendsCount()
  .then(() => {
    console.log('\n✨ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

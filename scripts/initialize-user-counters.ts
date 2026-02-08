/**
 * Script para inicializar contadores de amizade nos documentos de usuário
 *
 * Este script:
 * 1. Busca todos os usuários
 * 2. Para cada usuário, conta suas amizades aceitas, solicitações pendentes e enviadas
 * 3. Atualiza o documento do usuário com os contadores corretos
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

async function initializeUserCounters() {
  console.log('🚀 Iniciando inicialização de contadores de usuário...\n');
  console.log(`📝 Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}\n`);

  try {
    // 1. Buscar todos os usuários
    console.log('📊 Buscando todos os usuários...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`✅ Encontrados ${usersSnapshot.docs.length} usuários\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // 2. Processar cada usuário
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        // Contar amizades aceitas
        const friendsQuery = query(
          collection(db, 'friendships'),
          where('userId', '==', userId),
          where('status', '==', 'accepted')
        );
        const friendsSnapshot = await getDocs(friendsQuery);
        const friendsCount = friendsSnapshot.docs.length;

        // Contar solicitações recebidas pendentes
        const pendingRequestsQuery = query(
          collection(db, 'friendships'),
          where('userId', '==', userId),
          where('status', '==', 'pending'),
          where('requestedBy', '!=', userId)
        );
        const pendingRequestsSnapshot = await getDocs(pendingRequestsQuery);
        const pendingRequestsCount = pendingRequestsSnapshot.docs.length;

        // Contar solicitações enviadas pendentes
        const sentRequestsQuery = query(
          collection(db, 'friendships'),
          where('userId', '==', userId),
          where('status', '==', 'pending'),
          where('requestedBy', '==', userId)
        );
        const sentRequestsSnapshot = await getDocs(sentRequestsQuery);
        const sentRequestsCount = sentRequestsSnapshot.docs.length;

        // Verificar se precisa atualizar
        const needsUpdate =
          userData.friendsCount !== friendsCount ||
          userData.pendingRequestsCount !== pendingRequestsCount ||
          userData.sentRequestsCount !== sentRequestsCount;

        if (needsUpdate) {
          console.log(`📝 Usuário: ${userData.displayName || userId}`);
          console.log(`   Amigos: ${userData.friendsCount ?? 'N/A'} → ${friendsCount}`);
          console.log(`   Solicitações recebidas: ${userData.pendingRequestsCount ?? 'N/A'} → ${pendingRequestsCount}`);
          console.log(`   Solicitações enviadas: ${userData.sentRequestsCount ?? 'N/A'} → ${sentRequestsCount}`);

          if (!DRY_RUN) {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
              friendsCount,
              pendingRequestsCount,
              sentRequestsCount,
              updatedAt: new Date()
            });
            console.log(`   ✅ Atualizado\n`);
          } else {
            console.log(`   ⏭️  Simulação - não atualizado\n`);
          }

          updatedCount++;
        }

        processedCount++;
      } catch (error) {
        console.error(`❌ Erro ao processar usuário ${userId}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(50));
    console.log(`Total de usuários processados: ${processedCount}`);
    console.log(`Usuários atualizados: ${updatedCount}`);
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
initializeUserCounters()
  .then(() => {
    console.log('\n✨ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  });

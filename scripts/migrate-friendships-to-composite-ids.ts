/**
 * Script de Migração: Friendships com IDs Aleatórios → IDs Compostos
 *
 * Este script migra documentos de friendships de IDs aleatórios (ex: "i4WK6i0Lj2EYviqv0Sgn")
 * para IDs compostos (ex: "userId1_userId2") usados por redes sociais grandes.
 *
 * ANTES DE EXECUTAR:
 * 1. Faça backup do Firestore
 * 2. Execute em ambiente de desenvolvimento primeiro
 * 3. Verifique os logs antes de aplicar em produção
 *
 * Como executar:
 * npx tsx scripts/migrate-friendships-to-composite-ids.ts
 *
 * Ou adicione ao package.json:
 * "scripts": {
 *   "migrate:friendships": "tsx scripts/migrate-friendships-to-composite-ids.ts"
 * }
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  getDoc,
  query,
  limit as firestoreLimit
} from 'firebase/firestore';

// ==================== CONFIGURAÇÃO ====================

// Importar dotenv para ler variáveis de ambiente do .env
import dotenv from 'dotenv';
dotenv.config();

// Usar as mesmas credenciais do app principal
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

// Validar credenciais
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Erro: Variáveis de ambiente do Firebase não encontradas!');
  console.error('   Certifique-se de que o arquivo .env existe e contém as credenciais.');
  process.exit(1);
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==================== CONSTANTES ====================

const BATCH_SIZE = 500; // Firestore permite max 500 operações por batch
const DRY_RUN = false; // Mude para false para executar de verdade

// ==================== TIPOS ====================

interface FriendshipDoc {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  requestedBy: string;
  createdAt: any;
  updatedAt: any;
  friendshipDate?: any;
  friend: any;
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Verifica se o ID é aleatório (não é composto)
 */
const isRandomId = (id: string): boolean => {
  return !id.includes('_');
};

/**
 * Gera ID composto no formato userId_friendId
 */
const generateCompositeId = (userId: string, friendId: string): string => {
  return `${userId}_${friendId}`;
};

/**
 * Busca todos os documentos de friendships
 */
const getAllFriendships = async (): Promise<FriendshipDoc[]> => {
  console.log('📚 Buscando todos os documentos de friendships...');

  const friendshipsRef = collection(db, 'friendships');
  const snapshot = await getDocs(friendshipsRef);

  const friendships: FriendshipDoc[] = [];

  snapshot.docs.forEach(docSnapshot => {
    const data = docSnapshot.data();
    friendships.push({
      id: docSnapshot.id,
      userId: data.userId,
      friendId: data.friendId,
      status: data.status,
      requestedBy: data.requestedBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      friendshipDate: data.friendshipDate,
      friend: data.friend
    });
  });

  console.log(`✅ Encontrados ${friendships.length} documentos`);
  return friendships;
};

/**
 * Filtra apenas documentos com IDs aleatórios
 */
const filterRandomIds = (friendships: FriendshipDoc[]): FriendshipDoc[] => {
  return friendships.filter(f => isRandomId(f.id));
};

/**
 * Agrupa pares de documentos (userId_friendId e friendId_userId)
 */
const groupFriendshipPairs = (friendships: FriendshipDoc[]): Map<string, FriendshipDoc[]> => {
  const pairs = new Map<string, FriendshipDoc[]>();

  friendships.forEach(friendship => {
    // Criar chave única ordenada para o par
    const [user1, user2] = [friendship.userId, friendship.friendId].sort();
    const pairKey = `${user1}_${user2}`;

    if (!pairs.has(pairKey)) {
      pairs.set(pairKey, []);
    }
    pairs.get(pairKey)!.push(friendship);
  });

  return pairs;
};

/**
 * Valida se o par de documentos está completo
 */
const validatePair = (pair: FriendshipDoc[]): boolean => {
  if (pair.length !== 2) {
    console.warn(`⚠️ Par incompleto encontrado (${pair.length} documentos):`, pair.map(p => p.id));
    return false;
  }

  // Verificar se os documentos são espelhos um do outro
  const [doc1, doc2] = pair;
  const isValid =
    doc1.userId === doc2.friendId &&
    doc1.friendId === doc2.userId &&
    doc1.status === doc2.status;

  if (!isValid) {
    console.warn(`⚠️ Par inconsistente:`, {
      doc1: { id: doc1.id, userId: doc1.userId, friendId: doc1.friendId, status: doc1.status },
      doc2: { id: doc2.id, userId: doc2.userId, friendId: doc2.friendId, status: doc2.status }
    });
  }

  return isValid;
};

/**
 * Migra um batch de pares de documentos
 */
const migrateBatch = async (pairs: FriendshipDoc[][], dryRun: boolean = true): Promise<number> => {
  if (dryRun) {
    console.log(`🔍 [DRY RUN] Simulando migração de ${pairs.length} pares...`);
    return pairs.length * 2; // 2 documentos por par
  }

  const batch = writeBatch(db);
  let operationCount = 0;

  for (const pair of pairs) {
    const [doc1, doc2] = pair;

    // Criar novos IDs compostos
    const newId1 = generateCompositeId(doc1.userId, doc1.friendId);
    const newId2 = generateCompositeId(doc2.userId, doc2.friendId);

    // Verificar se documentos com novos IDs já existem
    const newDoc1Ref = doc(db, 'friendships', newId1);
    const newDoc2Ref = doc(db, 'friendships', newId2);

    const [existingDoc1, existingDoc2] = await Promise.all([
      getDoc(newDoc1Ref),
      getDoc(newDoc2Ref)
    ]);

    if (existingDoc1.exists() || existingDoc2.exists()) {
      console.warn(`⚠️ Documentos com IDs compostos já existem, pulando: ${newId1}, ${newId2}`);
      continue;
    }

    // Criar novos documentos com IDs compostos
    const doc1Data = {
      userId: doc1.userId,
      friendId: doc1.friendId,
      status: doc1.status,
      requestedBy: doc1.requestedBy,
      createdAt: doc1.createdAt,
      updatedAt: doc1.updatedAt,
      friendshipDate: doc1.friendshipDate || null,
      friend: doc1.friend
    };

    const doc2Data = {
      userId: doc2.userId,
      friendId: doc2.friendId,
      status: doc2.status,
      requestedBy: doc2.requestedBy,
      createdAt: doc2.createdAt,
      updatedAt: doc2.updatedAt,
      friendshipDate: doc2.friendshipDate || null,
      friend: doc2.friend
    };

    batch.set(newDoc1Ref, doc1Data);
    batch.set(newDoc2Ref, doc2Data);

    // Deletar documentos antigos
    batch.delete(doc(db, 'friendships', doc1.id));
    batch.delete(doc(db, 'friendships', doc2.id));

    operationCount += 4; // 2 creates + 2 deletes
  }

  if (operationCount > 0) {
    await batch.commit();
    console.log(`✅ Batch commitado com ${operationCount} operações`);
  }

  return operationCount;
};

/**
 * Divide array em chunks
 */
const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// ==================== FUNÇÃO PRINCIPAL ====================

const migrateFriendships = async () => {
  console.log('🚀 Iniciando migração de friendships...');
  console.log(`⚙️ Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'PRODUÇÃO (vai alterar dados!)'}`);
  console.log('');

  try {
    // 1. Buscar todos os documentos
    const allFriendships = await getAllFriendships();

    // 2. Filtrar apenas IDs aleatórios
    const randomIdFriendships = filterRandomIds(allFriendships);
    console.log(`🔍 Documentos com IDs aleatórios: ${randomIdFriendships.length}`);
    console.log(`✅ Documentos já com IDs compostos: ${allFriendships.length - randomIdFriendships.length}`);
    console.log('');

    if (randomIdFriendships.length === 0) {
      console.log('✅ Nenhum documento precisa ser migrado!');
      return;
    }

    // 3. Agrupar em pares
    const pairs = groupFriendshipPairs(randomIdFriendships);
    console.log(`👥 Pares de friendships encontrados: ${pairs.size}`);
    console.log('');

    // 4. Validar pares
    const validPairs: FriendshipDoc[][] = [];
    const invalidPairs: FriendshipDoc[][] = [];

    pairs.forEach((pair, key) => {
      if (validatePair(pair)) {
        validPairs.push(pair);
      } else {
        invalidPairs.push(pair);
      }
    });

    console.log(`✅ Pares válidos: ${validPairs.length}`);
    console.log(`❌ Pares inválidos: ${invalidPairs.length}`);
    console.log('');

    if (invalidPairs.length > 0) {
      console.log('⚠️ ATENÇÃO: Pares inválidos detectados. Revise antes de prosseguir!');
      console.log('Pares inválidos:', invalidPairs.map(p => p.map(d => d.id)));
      console.log('');
    }

    // 5. Dividir em batches (max 125 pares = 500 operações)
    const batchSize = Math.floor(BATCH_SIZE / 4); // 4 operações por par
    const batches = chunk(validPairs, batchSize);

    console.log(`📦 Batches a processar: ${batches.length}`);
    console.log(`📊 Operações totais: ${validPairs.length * 4}`);
    console.log('');

    // 6. Processar batches
    let totalOperations = 0;

    for (let i = 0; i < batches.length; i++) {
      console.log(`🔄 Processando batch ${i + 1}/${batches.length}...`);
      const operations = await migrateBatch(batches[i], DRY_RUN);
      totalOperations += operations;

      // Pequeno delay entre batches para não sobrecarregar o Firestore
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('✅ MIGRAÇÃO CONCLUÍDA!');
    console.log('='.repeat(50));
    console.log(`📊 Total de pares migrados: ${validPairs.length}`);
    console.log(`📊 Total de operações: ${totalOperations}`);
    console.log('');

    if (DRY_RUN) {
      console.log('⚠️ ISTO FOI UMA SIMULAÇÃO (DRY RUN)');
      console.log('   Para executar de verdade, mude DRY_RUN = false no código');
    } else {
      console.log('✅ Dados migrados com sucesso!');
      console.log('   Teste as funcionalidades de amizade no app');
    }

  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    throw error;
  }
};

// ==================== EXECUTAR ====================

migrateFriendships()
  .then(() => {
    console.log('🏁 Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

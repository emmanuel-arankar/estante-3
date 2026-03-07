/**
 * Script de Migração: Backfill de Dados de Perfil em Notificações Antigas
 *
 * Este script iterará sobre todas as notificações e garantirá que
 * notificações antigas tenham os campos `actorName`, `actorPhoto` e `metadata.actorNickname`
 * preenchidos a partir dos dados em tempo real da tabela `users`.
 *
 * Como executar:
 * npx tsx scripts/backfill-notifications.ts
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.resolve(__dirname, '../backend-api/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const DRY_RUN = false; // Mude para false para executar no banco real

const BIDI_REGEX = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const HAS_BIDI = (str: string) => typeof str === 'string' && BIDI_REGEX.test(str);

const IS_ZALGO_OR_DIRTY = (str: string) => {
  return /[\u0300-\u036F]/.test(str.normalize('NFC'));
};

const backfillNotifications = async () => {
  console.log('🚀 Iniciando Backfill de Notificações...');
  console.log(`⚙️ Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'PRODUÇÃO (vai alterar dados!)'}`);

  try {
    const snapshot = await db.collection('notifications').get();

    console.log(`📚 Buscando todos os documentos de notificações: Encontradas ${snapshot.size}`);

    const usersCache = new Map<string, any>();
    const updates: { ref: any, data: any }[] = [];

    // Iterar para encontrar deficientes
    for (const docSnapshot of snapshot.docs) {
      const notifData = docSnapshot.data();

      // Checar todos (não só de friend_accepted) porque algumas antigas nem the actorName
      if (!notifData.metadata?.actorNickname || !notifData.actorName || HAS_BIDI(notifData.actorName) || IS_ZALGO_OR_DIRTY(notifData.actorName)) {
        let actorId = notifData.actorId;

        // Se a notificação tiver actorId, vamos puxar este perfil
        if (actorId && typeof actorId === 'string') {
          if (!usersCache.has(actorId)) {
            const userSnap = await db.collection('users').doc(actorId).get();
            if (userSnap.exists) {
              usersCache.set(actorId, userSnap.data());
            } else {
              usersCache.set(actorId, null); // Sem registro
            }
          }

          const actorProfile = usersCache.get(actorId);

          if (actorProfile) {
            const newMetadata = notifData.metadata || {};
            newMetadata.actorNickname = actorProfile.nickname;

            updates.push({
              ref: docSnapshot.ref,
              data: {
                actorName: actorProfile.displayName || notifData.actorName || 'Alguém',
                actorPhoto: actorProfile.photoURL || notifData.actorPhoto || null,
                metadata: newMetadata
              }
            });
          }
        }
      }
    }

    console.log(`\n🔍 Resumo da Leitura: ${updates.length} notificações precisam de Backfill.`);

    if (updates.length > 0 && !DRY_RUN) {
      console.log('📦 Executando batches para salvar...');
      let batches: any[] = [];
      let currentBatch = db.batch();
      let opCount = 0;

      for (const update of updates) {
        currentBatch.update(update.ref, update.data);
        opCount++;

        if (opCount >= 490) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) batches.push(currentBatch);

      await Promise.all(batches.map(b => b.commit()));
      console.log(`✅ Backfill completo. Atualizados ${updates.length} documentos.`);
    } else if (DRY_RUN) {
      console.log('⚠️ Simulação concluída. Nada comitado.');
    } else {
      console.log('✅ Nenhuma atualização de Notificação necessária.');
    }

  } catch (err) {
    console.error('❌ Fallhou na execução do de reparação:', err);
  }
};

backfillNotifications()
  .then(() => {
    console.log('🏁 Script finalizado');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
  });

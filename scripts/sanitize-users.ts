/**
 * Script de Migração: Higienização de Usuários (Bidi Overrides e Bio Gigante)
 *
 * Este script iterará sobre todos os usuários e fará duas coisas:
 * 1. Remover caracteres invisíveis (Right-to-Left e Left-to-Right Overrides) que bagunçam a UI.
 * 2. Truncar (cortar) 'bio' que ultrapassem o limite de 1500 caracteres.
 */

import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho absoluto para a Service Account Key do backend-api
const serviceAccountPath = path.resolve(__dirname, '../backend-api/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const BIDI_REGEX = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const HAS_BIDI = (str: string) => {
    return /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(str);
};

const IS_ZALGO_OR_DIRTY = (str: string) => {
    // Se, após normalizar, existerem marcas combinadas (Strikethroughs ou acentos excedentes)
    return /[\u0300-\u036F]/.test(str.normalize('NFC'));
};

const sanitizeUsers = async () => {
    console.log('🚀 Iniciando Higienização de Usuários...');

    try {
        const snapshot = await db.collection('users').get();

        const updates: { ref: any, data: any }[] = [];

        for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();
            let needsUpdate = false;
            const updatePayload: any = {};

            // 1. Verificar e limpar Display Name
            if (data.displayName && typeof data.displayName === 'string') {
                if (HAS_BIDI(data.displayName) || IS_ZALGO_OR_DIRTY(data.displayName)) {
                    updatePayload.displayName = data.displayName.replace(BIDI_REGEX, '').normalize('NFC').replace(/[\u0300-\u036F]/g, '');
                    needsUpdate = true;
                }
            }

            // 2. Verificar e limpar Nickname
            if (data.nickname && typeof data.nickname === 'string') {
                if (HAS_BIDI(data.nickname) || IS_ZALGO_OR_DIRTY(data.nickname)) {
                    updatePayload.nickname = data.nickname.replace(BIDI_REGEX, '').normalize('NFC').replace(/[\u0300-\u036F]/g, '');
                    needsUpdate = true;
                }
            }

            // 3. Verificar e limpar/truncar Bio
            if (data.bio && typeof data.bio === 'string') {
                let cleanBio = data.bio;
                let modified = false;

                if (HAS_BIDI(cleanBio) || IS_ZALGO_OR_DIRTY(cleanBio)) {
                    cleanBio = cleanBio.replace(BIDI_REGEX, '').normalize('NFC').replace(/[\u0300-\u036F]/g, '');
                    modified = true;
                }

                // Cortar baseado nos emojis via conversores array para n quebrar surrogate pairs
                const charArray = Array.from(cleanBio);
                if (charArray.length > 1500) {
                    cleanBio = charArray.slice(0, 1500).join('');
                    modified = true;
                }

                if (modified) {
                    updatePayload.bio = cleanBio;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                updates.push({
                    ref: docSnapshot.ref,
                    data: updatePayload
                });
            }
        }

        console.log(`\n🔍 Resumo: ${updates.length} usuários necessitam de limpeza.`);

        if (updates.length > 0) {
            console.log('📦 Processando limpeza no banco de dados...');
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
            console.log(`✅ Higienização completa. Modificados ${updates.length} usuários.`);
        }

    } catch (err) {
        console.error('❌ Falha:', err);
    }
};

sanitizeUsers()
    .then(() => process.exit(0))
    .catch((err) => process.exit(1));

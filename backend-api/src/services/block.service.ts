import { db } from '../firebase';

/**
 * Verifica se existe bloqueio entre dois usuários (qualquer direção).
 * Retorna true se houver bloqueio.
 */
export const checkBlockStatus = async (userId1: string, userId2: string): Promise<boolean> => {
    // IDs de documento compostos: 'blockerId_blockedId'
    const blockRef1 = db.collection('blocks').doc(`${userId1}_${userId2}`); // userId1 bloqueou userId2
    const blockRef2 = db.collection('blocks').doc(`${userId2}_${userId1}`); // userId2 bloqueou userId1

    const [doc1, doc2] = await Promise.all([blockRef1.get(), blockRef2.get()]);

    return doc1.exists || doc2.exists;
};

/**
 * Verifica se blockerId bloqueou blockedId (direção específica).
 * Retorna true se blockerId bloqueou blockedId.
 */
export const isBlockedBy = async (blockerId: string, blockedId: string): Promise<boolean> => {
    const blockRef = db.collection('blocks').doc(`${blockerId}_${blockedId}`);
    const doc = await blockRef.get();
    return doc.exists;
};

/**
 * Lança erro se houver bloqueio
 */
export const ensureNotBlocked = async (userId1: string, userId2: string) => {
    const isBlocked = await checkBlockStatus(userId1, userId2);
    if (isBlocked) {
        throw new Error('Ação não permitida devido a bloqueio.');
    }
};

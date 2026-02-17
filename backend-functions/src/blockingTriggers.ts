import {
    onDocumentCreated,
    FirestoreEvent,
    QueryDocumentSnapshot
} from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const getDb = () => admin.firestore();

/**
 * Trigger: On Block Created
 * When User A blocks User B:
 * 1. Find and delete friendship (A->B and B->A)
 * 2. Find and delete pending requests (A->B and B->A)
 */
export const onBlockCreated = onDocumentCreated({
    document: 'blocks/{blockId}',
    vpcConnector: 'estante-connector',
    vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data) return;

    const { blockerId, blockedId } = data;

    if (!blockerId || !blockedId) {
        console.error('Block document missing blockerId or blockedId', data);
        return;
    }

    const db = getDb();
    const batch = db.batch();
    let deleteCount = 0;

    try {
        // Query 1: Friendships/Requests where userId == blockerId AND friendId == blockedId
        // (This covers A->B direction)
        const q1 = await db.collection('friendships')
            .where('userId', '==', blockerId)
            .where('friendId', '==', blockedId)
            .get();

        q1.docs.forEach(doc => {
            batch.delete(doc.ref);
            deleteCount++;
        });

        // Query 2: Friendships/Requests where userId == blockedId AND friendId == blockerId
        // (This covers B->A direction)
        const q2 = await db.collection('friendships')
            .where('userId', '==', blockedId)
            .where('friendId', '==', blockerId)
            .get();

        q2.docs.forEach(doc => {
            batch.delete(doc.ref);
            deleteCount++;
        });

        if (deleteCount > 0) {
            await batch.commit();
            console.log(`[Block] ${blockerId} blocked ${blockedId}. Deleted ${deleteCount} friendship/request docs.`);
        } else {
            console.log(`[Block] ${blockerId} blocked ${blockedId}. No existing connection found to delete.`);
        }

    } catch (error) {
        console.error('[Block] Error cleaning up friendships:', error);
    }
});

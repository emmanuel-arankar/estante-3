import {
    onDocumentCreated,
    onDocumentUpdated,
    onDocumentDeleted,
    FirestoreEvent,
    QueryDocumentSnapshot,
    Change
} from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const getDb = () => admin.firestore();

/**
 * Trigger 1: Friend Request Created
 */
export const onFriendRequestCreated = onDocumentCreated({
    document: 'friendships/{friendshipId}',
    vpcConnector: 'estante-connector',
    vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data) return;

    const { userId, requestedBy } = data;

    if (data.status !== 'pending') return;
    if (requestedBy === userId) return;

    try {
        const db = getDb();
        const batch = db.batch();

        // 1. Criar notificação
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
            userId,
            type: 'FRIEND_REQUEST',
            actorId: requestedBy,
            actorName: 'Usuário', // Será preenchido pelo client se necessário ou via func dedicada
            actorPhoto: '',
            read: false,
            createdAt: admin.firestore.Timestamp.now(),
            metadata: {
                friendshipId: event.params.friendshipId
            }
        });

        // 2. Incrementar contadores
        // Receiver: +1 pendingRequestsCount
        const receiverRef = db.collection('users').doc(userId);
        batch.update(receiverRef, {
            pendingRequestsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });

        // Sender: +1 sentRequestsCount
        const senderRef = db.collection('users').doc(requestedBy);
        batch.update(senderRef, {
            sentRequestsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });

        await batch.commit();
        console.log(`Solicitação criada: ${requestedBy} → ${userId}. Contadores atualizados.`);
    } catch (error) {
        console.error('Erro ao processar criação de solicitação:', error);
    }
});

/**
 * Trigger 2: Friend Request Accepted
 */
export const onFriendRequestAccepted = onDocumentUpdated({
    document: 'friendships/{friendshipId}',
    vpcConnector: 'estante-connector',
    vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
}, async (event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined>) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;
    if (before.status !== 'pending' || after.status !== 'accepted') return;

    const { requestedBy, userId } = after;
    if (requestedBy === userId) return;

    try {
        const db = getDb();
        const batch = db.batch();

        // 1. Notificações (mantido lógica anterior, mas otimizado)
        // Buscamos dados apenas para notificação, se falhar, não impede contadores
        const [requesterDoc, accepterDoc] = await Promise.all([
            db.collection('users').doc(requestedBy).get(),
            db.collection('users').doc(userId).get()
        ]);
        const requesterData = requesterDoc.data() || {};
        const accepterData = accepterDoc.data() || {};

        const notifRef1 = db.collection('notifications').doc();
        batch.set(notifRef1, {
            userId: requestedBy,
            type: 'FRIEND_ACCEPTED',
            actorId: userId,
            actorName: accepterData.displayName || 'Usuário',
            actorPhoto: accepterData.photoURL || '',
            read: false,
            createdAt: admin.firestore.Timestamp.now(),
            metadata: {
                friendshipId: event.params.friendshipId,
                isRequester: true
            }
        });

        const notifRef2 = db.collection('notifications').doc();
        batch.set(notifRef2, {
            userId: userId,
            type: 'FRIEND_ACCEPTED',
            actorId: requestedBy,
            actorName: requesterData.displayName || 'Usuário',
            actorPhoto: requesterData.photoURL || '',
            read: false,
            createdAt: admin.firestore.Timestamp.now(),
            metadata: {
                friendshipId: event.params.friendshipId,
                isRequester: false
            }
        });

        // 2. Atualizar Contadores
        // Requester (quem enviou): -1 sentRequestsCount, +1 friendsCount
        const requesterRef = db.collection('users').doc(requestedBy);
        batch.update(requesterRef, {
            sentRequestsCount: admin.firestore.FieldValue.increment(-1),
            friendsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });

        // User (quem aceitou): -1 pendingRequestsCount, +1 friendsCount
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
            friendsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.Timestamp.now()
        });

        // 3. Analytics
        const analyticsRef = db.collection('analytics').doc();
        batch.set(analyticsRef, {
            event: 'FRIEND_REQUEST_ACCEPTED',
            userId: requestedBy,
            friendId: userId,
            timestamp: admin.firestore.Timestamp.now()
        });

        await batch.commit();
        console.log(`Solicitação aceita: ${requestedBy} + ${userId}. Contadores e notificações atualizados.`);
    } catch (error) {
        console.error('Erro ao processar aceitação:', error);
    }
});

/**
 * Trigger 4: Friendship Deleted
 * Handles:
 * 1. Unfriend (status: accepted) -> -1 friendsCount
 * 2. Reject/Cancel (status: pending) -> -1 pending/sent counts
 */
export const onFriendshipDeleted = onDocumentDeleted({
    document: 'friendships/{friendshipId}',
    vpcConnector: 'estante-connector',
    vpcConnectorEgressSettings: 'PRIVATE_RANGES_ONLY',
}, async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data) return;

    const { userId, requestedBy, status, friendId } = data; // friendId might be undefined in oldest docs

    try {
        const db = getDb();
        const batch = db.batch();

        if (status === 'accepted') {
            // Caso 1: Desfazer amizade
            // Decrementar friendsCount de AMBOS
            // Nota: friendship doc tem userId e friendId, mas às vezes requestedBy.
            // O padrão do sistema é criar DOIS documentos (A->B e B->A)?
            // Visualizando `firestore.ts`: createFriendship cria DOIS docs.
            // ENTÃO, este trigger roda DUAS VEZES (uma pra cada doc deletado).
            // Portanto, devemos decrementar APENAS do dono do documento (`userId`).

            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, {
                friendsCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.Timestamp.now()
            });

            // Analytics
            const analyticsRef = db.collection('analytics').doc();
            batch.set(analyticsRef, {
                event: 'FRIENDSHIP_REMOVED',
                userId: userId,
                friendId: friendId || 'unknown',
                timestamp: admin.firestore.Timestamp.now()
            });

            console.log(`Amizade removida para ${userId}. friendsCount -1.`);

        } else if (status === 'pending') {
            // Caso 2: Rejeitar ou Cancelar
            // O sistema também cria dois docs para pending?
            // `firestore.ts`: Sim, sendFriendRequest cria dois docs com status 'pending'.
            // Documento 1: userId=Sender, friendId=Receiver, requestedBy=Sender
            // Documento 2: userId=Receiver, friendId=Sender, requestedBy=Sender

            if (userId === requestedBy) {
                // Este é o documento do REMENTENTE (Sender)
                // Decrementar sentRequestsCount
                const senderRef = db.collection('users').doc(userId);
                batch.update(senderRef, {
                    sentRequestsCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.Timestamp.now()
                });
                console.log(`Solicitação cancelada/rejeitada para Sender ${userId}. sentRequestsCount -1.`);
            } else {
                // Este é o documento do DESTINATÁRIO (Receiver)
                // Decrementar pendingRequestsCount
                const receiverRef = db.collection('users').doc(userId);
                batch.update(receiverRef, {
                    pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
                    updatedAt: admin.firestore.Timestamp.now()
                });
                console.log(`Solicitação cancelada/rejeitada para Receiver ${userId}. pendingRequestsCount -1.`);
            }
        }

        await batch.commit();
    } catch (error) {
        console.error('Erro ao processar remoção de amizade:', error);
    }
});

// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router } from 'express';
import { admin, db } from './firebase';
import { checkAuth, checkAuthOptional } from './middleware/auth.middleware';
import {
    createReviewSchema,
    updateReviewSchema,
    reviewIdParamSchema,
    createCommentSchema,
    updateCommentSchema,
    editionIdParamSchema
} from './schemas/books.schema';

const router = Router();

// =============================================================================
// HELPERS
// =============================================================================

const sanitizeTimestamps = (data: any) => {
    const result = { ...data };
    for (const key of ['createdAt', 'updatedAt']) {
        if (result[key]?.toDate) result[key] = result[key].toDate();
    }
    return result;
};

const now = () => admin.firestore.Timestamp.now();

// Dispara notificação se o ator não for o próprio dono
async function notifyAction(targetUserId: string, actorId: string, type: string, extraMetadata: any = {}) {
    if (targetUserId === actorId) return;

    try {
        const actorDoc = await db.collection('users').doc(actorId).get();
        const actorData = actorDoc.data();
        if (!actorData) return;

        await db.collection('notifications').add({
            userId: targetUserId,
            actorId: actorId,
            actorName: actorData.displayName || '',
            actorPhoto: actorData.photoURL || null,
            type,
            read: false,
            createdAt: now(),
            updatedAt: now(),
            metadata: {
                actorNickname: actorData.nickname || '',
                ...extraMetadata
            }
        });
    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
    }
}


// =============================================================================
// REVIEWS
// =============================================================================

async function recalculateEditionMetrics(editionId: string) {
    const snapshot = await db.collection('reviews').where('editionId', '==', editionId).get();

    let ratingsCount = 0;
    let reviewsCount = 0;
    let sumRatings = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasText = data.title || (data.content && data.content.replace(/<[^>]*>?/gm, '').trim().length > 10);
        const hasRating = typeof data.rating === 'number';

        if (hasText) reviewsCount++;
        if (hasRating) {
            ratingsCount++;
            sumRatings += data.rating;
        }
    });

    const averageRating = ratingsCount > 0 ? Number((sumRatings / ratingsCount).toFixed(2)) : 0;

    await db.collection('editions').doc(editionId).update({
        'stats.ratingsCount': ratingsCount,
        'stats.reviewsCount': reviewsCount,
        'stats.averageRating': averageRating
    });

    // Também recalcula a obra vinculada
    if (snapshot.docs.length > 0) {
        const workId = snapshot.docs[0].data().workId;
        if (workId) await recalculateWorkMetrics(workId);
    }
}

async function recalculateWorkMetrics(workId: string) {
    const snapshot = await db.collection('reviews').where('workId', '==', workId).get();

    let ratingsCount = 0;
    let reviewsCount = 0;
    let sumRatings = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasText = data.title || (data.content && data.content.replace(/<[^>]*>?/gm, '').trim().length > 10);
        const hasRating = typeof data.rating === 'number';

        if (hasText) reviewsCount++;
        if (hasRating) {
            ratingsCount++;
            sumRatings += data.rating;
        }
    });

    const averageRating = ratingsCount > 0 ? Number((sumRatings / ratingsCount).toFixed(2)) : 0;

    await db.collection('works').doc(workId).update({
        'stats.ratingsCount': ratingsCount,
        'stats.reviewsCount': reviewsCount,
        'stats.averageRating': averageRating
    });
}

/**
 * @route POST /api/reviews
 * @summary Criar uma review para uma edição
 */
router.post('/reviews', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const v = createReviewSchema.safeParse(req.body);
        if (!v.success) {
            res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });
            return;
        }

        const userId = req.user!.uid;
        const data = v.data;

        // Verificar se edição existe
        const editionRef = db.collection('editions').doc(data.editionId);
        const editionDoc = await editionRef.get();

        if (!editionDoc.exists) {
            res.status(404).json({ error: 'Edição não encontrada' });
            return;
        }

        const editionData = editionDoc.data()!;

        // Verificar se o usuário já tem review para essa OBRA (independente da edição)
        // Estratégia em cascata: Tentar ID da edição, se não tiver, usar o que veio no body (enviado pelo frontend)
        let workId = typeof editionData.workId === 'string' ? editionData.workId : editionData.workId?.id;
        if (!workId) {
            workId = (data as any).workId;
        }
        
        console.log(`[Review Debug] Final workId for UPSERT: ${workId} (from edition: ${!!editionData.workId})`);
        
        if (!workId) {
             console.error('[Review Error] workId não pôde ser identificado nem na edição nem na requisição!');
             res.status(400).json({ error: 'Erro de integridade: obra não identificada.' });
             return;
        }

        // Busca por userId + workId (identificador único global de avaliação por pessoa)
        const existingReviewQuery = await db.collection('reviews')
            .where('userId', '==', userId)
            .where('workId', '==', workId)
            .get();

        console.log(`[Review Debug] Query por workId ${workId} retornou ${existingReviewQuery.size} docs.`);

        if (!existingReviewQuery.empty) {
            // FAXINA: Se houver mais de uma, deletamos as excedentes
            const docs = existingReviewQuery.docs;
            const reviewDoc = docs[0];
            const reviewId = reviewDoc.id;

            if (docs.length > 1) {
                console.log(`[Review Debug] FAXINA: Removendo ${docs.length - 1} duplicatas para o usuário ${userId}`);
                const batch = db.batch();
                for (let i = 1; i < docs.length; i++) {
                    batch.delete(docs[i].ref);
                }
                await batch.commit();
            }

            console.log(`[Review Debug] Executando UPDATE no documento ${reviewId}`);
            const updates: any = { 
                rating: data.rating !== undefined ? data.rating : reviewDoc.data().rating,
                editionId: data.editionId, 
                updatedAt: now() 
            };
            
            await db.collection('reviews').doc(reviewId).update(updates);
            
            // Recalcula métricas com força total
            await recalculateEditionMetrics(data.editionId);
            const oldEditionId = reviewDoc.data().editionId;
            if (oldEditionId && oldEditionId !== data.editionId) {
                await recalculateEditionMetrics(oldEditionId);
            }
            await recalculateWorkMetrics(workId);

            const updatedDoc = { id: reviewId, ...reviewDoc.data(), ...updates };
            res.status(200).json(sanitizeTimestamps(updatedDoc));
            return;
        }

        // Recuperar dados do usuário para salvar snapshot
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data()!;

        const reviewData = {
            userId,
            editionId: data.editionId,
            workId: workId,
            rating: data.rating !== undefined ? data.rating : null,
            userName: userData.displayName || '',
            userNickname: userData.nickname || '',
            userPhotoUrl: userData.photoURL || null,
            title: data.title || null,
            content: data.content !== undefined ? data.content : null,
            containsSpoiler: data.containsSpoiler || false,
            likesCount: 0,
            commentsCount: 0,
            createdAt: now(),
            updatedAt: now()
        };

        const docRef = await db.collection('reviews').add(reviewData);

        // Recalcular métricas consolidadas na edição
        await recalculateEditionMetrics(data.editionId);

        res.status(201).json(sanitizeTimestamps({ id: docRef.id, ...reviewData }));
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/edition/:editionId/my
 * @summary Buscar resenha/avaliação do usuário atual
 */
router.get('/reviews/edition/:editionId/my', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const v = editionIdParamSchema.safeParse(req.params);
        if (!v.success) {
            res.status(400).json({ error: 'ID inválido', details: v.error.flatten().fieldErrors });
            return;
        }

        const snapshot = await db.collection('reviews')
            .where('editionId', '==', v.data.editionId)
            .where('userId', '==', req.user!.uid)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.json({ data: null });
        }

        const review = sanitizeTimestamps({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });

        // Embora seja a review do próprio usuário, verificamos isLiked por consistência
        const likeDoc = await db.collection('reviews').doc(review.id).collection('likes').doc(req.user!.uid).get();
        review.isLiked = likeDoc.exists;

        res.json({ data: review });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/edition/:editionId
 * @summary Listar reviews de uma edição específica
 */
/**
 * @route GET /api/reviews/edition/:editionId
 * @summary Listar reviews de uma edição específica
 */
router.get('/reviews/edition/:editionId', checkAuthOptional, async (req: any, res: any, next: any) => {
    try {
        const v = editionIdParamSchema.safeParse(req.params);
        if (!v.success) {
            res.status(400).json({ error: 'ID inválido', details: v.error.flatten().fieldErrors });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const snapshot = await db.collection('reviews')
            .where('editionId', '==', v.data.editionId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .offset((page - 1) * limit)
            .get();

        const userId = req.user?.uid;
        let reviews = snapshot.docs.map(doc => sanitizeTimestamps({ id: doc.id, ...doc.data() }));

        if (userId && reviews.length > 0) {
            const likeDocRefs = snapshot.docs.map(doc => db.collection('reviews').doc(doc.id).collection('likes').doc(userId));
            const likeDocs = await db.getAll(...likeDocRefs);
            reviews = reviews.map((review, index) => ({
                ...review,
                isLiked: likeDocs[index].exists
            }));
        }

        res.json({
            data: reviews,
            page,
            limit
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId
 * @summary Buscar uma review específica
 */
router.get('/reviews/:reviewId', checkAuthOptional, async (req: any, res: any, next: any) => {
    try {
        const v = reviewIdParamSchema.safeParse(req.params);
        if (!v.success) {
            res.status(400).json({ error: 'ID inválido', details: v.error.flatten().fieldErrors });
            return;
        }

        const doc = await db.collection('reviews').doc(v.data.reviewId).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Review não encontrada' });
            return;
        }

        const review = sanitizeTimestamps({ id: doc.id, ...doc.data() });

        if (req.user?.uid) {
            const likeDoc = await db.collection('reviews').doc(review.id).collection('likes').doc(req.user.uid).get();
            review.isLiked = likeDoc.exists;
        }

        res.json(review);
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/reviews/:reviewId
 * @summary Atualizar uma review
 */
router.put('/reviews/:reviewId', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const p = reviewIdParamSchema.safeParse(req.params);
        if (!p.success) {
            res.status(400).json({ error: 'ID inválido', details: p.error.flatten().fieldErrors });
            return;
        }

        const b = updateReviewSchema.safeParse(req.body);
        if (!b.success) {
            res.status(400).json({ error: 'Dados inválidos', details: b.error.flatten().fieldErrors });
            return;
        }

        const userId = req.user!.uid;
        const ref = db.collection('reviews').doc(p.data.reviewId);

        const doc = await ref.get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Review não encontrada' });
            return;
        }
        if (doc.data()!.userId !== userId) {
            res.status(403).json({ error: 'Sem permissão' });
            return;
        }

        const oldData = doc.data()!;
        const updates = { ...b.data, updatedAt: now() };
        await ref.update(updates);

        // Recalcular métricas consolidadas na edição e na obra
        await recalculateEditionMetrics(oldData.editionId);
        if (oldData.workId) await recalculateWorkMetrics(oldData.workId);

        res.json(sanitizeTimestamps({ id: doc.id, ...doc.data(), ...updates }));
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/reviews/:reviewId
 * @summary Deletar uma review
 */
router.delete('/reviews/:reviewId', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const p = reviewIdParamSchema.safeParse(req.params);
        if (!p.success) {
            res.status(400).json({ error: 'ID inválido' });
            return;
        }

        const userId = req.user!.uid;
        const ref = db.collection('reviews').doc(p.data.reviewId);
        const doc = await ref.get();

        if (!doc.exists) {
            res.status(404).json({ error: 'Review não encontrada' });
            return;
        }

        const data = doc.data()!;
        if (data.userId !== userId) {
            res.status(403).json({ error: 'Sem permissão' });
            return;
        }

        // Deletar a resenha e todas as suas subcoleções (comments, likes)
        if (typeof db.recursiveDelete === 'function') {
            await db.recursiveDelete(ref);
        } else {
            // Fallback caso sdk não suporte (geralmente firestore admin mais novo suporta)
            const bulkWriter = db.bulkWriter();
            bulkWriter.delete(ref);
            await db.recursiveDelete(ref, bulkWriter);
        }

        // Recalcular métricas consolidadas na edição e na obra
        await recalculateEditionMetrics(data.editionId);
        if (data.workId) await recalculateWorkMetrics(data.workId);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// COMENTÁRIOS DE REVIEWS
// =============================================================================

/**
 * @route POST /api/reviews/:reviewId/comments
 * @summary Adicionar comentário à review
 */
router.post('/reviews/:reviewId/comments', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const p = reviewIdParamSchema.safeParse(req.params);
        if (!p.success) {
            res.status(400).json({ error: 'ID de review inválido' });
            return;
        }

        const v = createCommentSchema.safeParse(req.body);
        if (!v.success) {
            res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });
            return;
        }

        const parentCommentId = req.body.parentCommentId as string | undefined;

        const reviewId = p.data.reviewId;
        const userId = req.user!.uid;

        const reviewRef = db.collection('reviews').doc(reviewId);
        const reviewDoc = await reviewRef.get();

        if (!reviewDoc.exists) {
            res.status(404).json({ error: 'Review não encontrada' });
            return;
        }

        let depth = 0;
        if (parentCommentId) {
            const parentDoc = await db.collection('reviews').doc(reviewId).collection('comments').doc(parentCommentId).get();
            if (!parentDoc.exists) {
                res.status(404).json({ error: 'Comentário pai não encontrado' });
                return;
            }
            depth = (parentDoc.data()?.depth || 0) + 1;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data()!;

        const commentData = {
            reviewId,
            parentCommentId: parentCommentId || null,
            userId,
            userName: userData.displayName || '',
            userNickname: userData.nickname || '',
            userPhotoUrl: userData.photoURL || null,
            content: v.data.content,
            likesCount: 0,
            depth,
            createdAt: now(),
            updatedAt: now()
        };

        const docRef = await reviewRef.collection('comments').add(commentData);

        await reviewRef.update({
            commentsCount: admin.firestore.FieldValue.increment(1)
        });

        // Notificar o dono do comentário pai, ou se for raiz, notificar o dono da resenha
        const reviewDataInfo = reviewDoc.data()!;
        let targetUserId = reviewDataInfo.userId;
        let notifType = 'review_comment_created';

        if (parentCommentId) {
            const parentDoc = await reviewRef.collection('comments').doc(parentCommentId).get();
            if (parentDoc.exists) {
                targetUserId = parentDoc.data()?.userId;
                notifType = 'comment_reply_created';
            }
        }

        await notifyAction(targetUserId, userId, notifType, {
            reviewId,
            commentId: docRef.id,
            workId: reviewDataInfo.workId,
            editionId: reviewDataInfo.editionId
        });

        res.status(201).json(sanitizeTimestamps({ id: docRef.id, ...commentData }));
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId/comments
 * @summary Listar comentários de uma review
 */
router.get('/reviews/:reviewId/comments', checkAuthOptional, async (req: any, res: any, next: any) => {
    try {
        const p = reviewIdParamSchema.safeParse(req.params);
        if (!p.success) {
            res.status(400).json({ error: 'ID inválido' });
            return;
        }

        const reviewId = p.data.reviewId;
        const snapshot = await db.collection('reviews').doc(reviewId).collection('comments')
            .orderBy('createdAt', 'asc')
            .get();

        const userId = req.user?.uid;
        let comments = snapshot.docs.map(doc => sanitizeTimestamps({ id: doc.id, ...doc.data() }));

        if (userId && comments.length > 0) {
            // Verificar quais comentários foram curtidos pelo usuário logado
            const likeDocRefs = snapshot.docs.map(doc =>
                db.collection('reviews').doc(reviewId)
                    .collection('comments').doc(doc.id)
                    .collection('likes').doc(userId)
            );

            const likeDocs = await db.getAll(...likeDocRefs);

            comments = comments.map((comment, index) => ({
                ...comment,
                isLiked: likeDocs[index].exists
            }));
        }

        res.json({ data: comments });
    } catch (error) {
        next(error);
    }
});

/**
 * @route PUT /api/reviews/:reviewId/comments/:commentId
 * @summary Editar um comentário próprio
 */
router.put('/reviews/:reviewId/comments/:commentId', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const commentId = req.params.commentId;
        const userId = req.user!.uid;
        const v = updateCommentSchema.safeParse(req.body);
        if (!v.success) {
            res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });
            return;
        }

        const { content } = v.data;
        const hasMedia = /<img/i.test(content || '');

        if (!content || typeof content !== 'string' || (!hasMedia && content.trim().length === 0)) {
            res.status(400).json({ error: 'Conteúdo inválido' });
            return;
        }

        const commentRef = db.collection('reviews').doc(reviewId).collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comentário não encontrado' });
            return;
        }

        if (commentDoc.data()!.userId !== userId) {
            res.status(403).json({ error: 'Sem permissão para editar este comentário' });
            return;
        }

        const updates = { content: content, updatedAt: now() }; // content já vem sanitizado pelo transform do zod
        await commentRef.update(updates);

        res.json(sanitizeTimestamps({ id: commentDoc.id, ...commentDoc.data(), ...updates }));
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/reviews/:reviewId/comments/:commentId/like
 * @summary Curtir ou descurtir um comentário (toggle)
 */
router.post('/reviews/:reviewId/comments/:commentId/like', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const commentId = req.params.commentId;
        const userId = req.user!.uid;

        const commentRef = db.collection('reviews').doc(reviewId).collection('comments').doc(commentId);
        const likeRef = commentRef.collection('likes').doc(userId);

        const [commentDoc, likeDoc] = await Promise.all([commentRef.get(), likeRef.get()]);

        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comentário não encontrado' });
            return;
        }

        const liked = likeDoc.exists;

        if (liked) {
            // Descurtir
            await likeRef.delete();
            await commentRef.update({ likesCount: admin.firestore.FieldValue.increment(-1) });
            res.json({ liked: false, likesCount: (commentDoc.data()!.likesCount || 1) - 1 });
        } else {
            // Curtir
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data()!;

            await likeRef.set({
                userId,
                userName: userData.displayName || '',
                userNickname: userData.nickname || '',
                userPhotoUrl: userData.photoURL || null,
                createdAt: now()
            });
            await commentRef.update({ likesCount: admin.firestore.FieldValue.increment(1) });

            const reviewDocForNotif = await db.collection('reviews').doc(reviewId).get();
            const revData = reviewDocForNotif.data() || {};

            await notifyAction(commentDoc.data()!.userId, userId, 'like_review_comment', {
                reviewId,
                commentId,
                workId: revData.workId,
                editionId: revData.editionId
            });

            res.json({ liked: true, likesCount: (commentDoc.data()!.likesCount || 0) + 1 });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * @route DELETE /api/reviews/:reviewId/comments/:commentId
 * @summary Deletar um comentário
 */
router.delete('/reviews/:reviewId/comments/:commentId', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const commentId = req.params.commentId;
        const userId = req.user!.uid;

        const reviewRef = db.collection('reviews').doc(reviewId);
        const commentRef = reviewRef.collection('comments').doc(commentId);

        const commentDoc = await commentRef.get();
        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comentário não encontrado' });
            return;
        }

        if (commentDoc.data()!.userId !== userId) {
            res.status(403).json({ error: 'Sem permissão para deletar este comentário' });
            return;
        }

        // Deleta o comentário e contabiliza
        await commentRef.delete();
        let deletedCount = 1;

        // Limpa respostas filhas caso existam (se houver parentCommentId = commentId)
        const repliesSnapshot = await reviewRef.collection('comments').where('parentCommentId', '==', commentId).get();
        if (!repliesSnapshot.empty) {
            const bulkWriter = db.bulkWriter();
            repliesSnapshot.docs.forEach(doc => {
                bulkWriter.delete(doc.ref);
                deletedCount++;
            });
            await bulkWriter.close();
        }

        // Decrementa o contador de comentários na review com o total deletado (pai + filhas)
        await reviewRef.update({
            commentsCount: admin.firestore.FieldValue.increment(-deletedCount)
        });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// CURTIDAS EM REVIEWS E COMENTÁRIOS
// =============================================================================

/**
 * @route POST /api/reviews/:reviewId/like
 * @summary Curtir ou descurtir uma review (toggle)
 */
router.post('/reviews/:reviewId/like', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const userId = req.user!.uid;

        const reviewRef = db.collection('reviews').doc(reviewId);
        const likeRef = reviewRef.collection('likes').doc(userId);

        const [reviewDoc, likeDoc] = await Promise.all([reviewRef.get(), likeRef.get()]);

        if (!reviewDoc.exists) {
            res.status(404).json({ error: 'Review não encontrada' });
            return;
        }

        const liked = likeDoc.exists;

        if (liked) {
            await likeRef.delete();
            await reviewRef.update({ likesCount: admin.firestore.FieldValue.increment(-1) });
            res.json({ liked: false, likesCount: Math.max(0, (reviewDoc.data()!.likesCount || 1) - 1) });
        } else {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data()!;
            await likeRef.set({
                userId,
                userName: userData.displayName || '',
                userNickname: userData.nickname || '',
                userPhotoUrl: userData.photoURL || null,
                createdAt: now()
            });
            await reviewRef.update({ likesCount: admin.firestore.FieldValue.increment(1) });

            const reviewDataInfo = reviewDoc.data()!;
            await notifyAction(reviewDataInfo.userId, userId, 'like_review', {
                reviewId,
                workId: reviewDataInfo.workId,
                editionId: reviewDataInfo.editionId
            });

            res.json({ liked: true, likesCount: (reviewDataInfo.likesCount || 0) + 1 });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId/likes
 * @summary Listar quem curtiu uma review (primeiros 10)
 */
router.get('/reviews/:reviewId/likes', async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const snapshot = await db.collection('reviews').doc(reviewId)
            .collection('likes')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const likers = snapshot.docs.map(doc => doc.data());
        res.json({ data: likers });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId/likes/me
 * @summary Verificar se o usuário atual curtiu a review
 */
router.get('/reviews/:reviewId/likes/me', checkAuth, async (req: any, res: any, next: any) => {
    try {
        const reviewId = req.params.reviewId;
        const userId = req.user!.uid;
        const likeDoc = await db.collection('reviews').doc(reviewId).collection('likes').doc(userId).get();
        res.json({ liked: likeDoc.exists });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId/comments/:commentId/likes
 * @summary Listar quem curtiu um comentário (primeiros 10)
 */
router.get('/reviews/:reviewId/comments/:commentId/likes', async (req: any, res: any, next: any) => {
    try {
        const { reviewId, commentId } = req.params;
        const snapshot = await db.collection('reviews').doc(reviewId)
            .collection('comments').doc(commentId)
            .collection('likes')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const likers = snapshot.docs.map(doc => doc.data());
        res.json({ data: likers });
    } catch (error) {
        next(error);
    }
});

export default router;

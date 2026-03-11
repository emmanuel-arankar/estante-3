// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router } from 'express';
import { admin, db } from './firebase';
import { checkAuth } from './middleware/auth.middleware';
import {
    createReviewSchema,
    updateReviewSchema,
    reviewIdParamSchema,
    createCommentSchema,
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
        ratingsCount,
        reviewsCount,
        averageRating
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

        // Verificar se o usuário já tem review para essa edição
        const existingReviewQuery = await db.collection('reviews')
            .where('userId', '==', userId)
            .where('editionId', '==', data.editionId)
            .limit(1)
            .get();

        if (!existingReviewQuery.empty) {
            res.status(409).json({ error: 'Você já avaliou esta edição. Use a edição de review.' });
            return;
        }

        // Recuperar dados do usuário para salvar snapshot
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data()!;

        const reviewData = {
            userId,
            editionId: data.editionId,
            workId: editionData.workId,
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

        res.json({ data: sanitizeTimestamps({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() }) });
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/edition/:editionId
 * @summary Listar reviews de uma edição específica
 */
router.get('/reviews/edition/:editionId', async (req: any, res: any, next: any) => {
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

        const reviews = snapshot.docs.map(doc => sanitizeTimestamps({ id: doc.id, ...doc.data() }));

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
router.get('/reviews/:reviewId', async (req: any, res: any, next: any) => {
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

        res.json(sanitizeTimestamps({ id: doc.id, ...doc.data() }));
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

        // Recalcular métricas consolidadas na edição
        await recalculateEditionMetrics(oldData.editionId);

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

        await ref.delete();

        // Recalcular métricas consolidadas na edição
        await recalculateEditionMetrics(data.editionId);

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
            userName: userData.name || '',
            userNickname: userData.nickname || '',
            userPhotoUrl: userData.photoUrl || null,
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

        res.status(201).json(sanitizeTimestamps({ id: docRef.id, ...commentData }));
    } catch (error) {
        next(error);
    }
});

/**
 * @route GET /api/reviews/:reviewId/comments
 * @summary Listar comentários de uma review
 */
router.get('/reviews/:reviewId/comments', async (req: any, res: any, next: any) => {
    try {
        const p = reviewIdParamSchema.safeParse(req.params);
        if (!p.success) {
            res.status(400).json({ error: 'ID inválido' });
            return;
        }

        // Numa árvore real com profundidade, podemos buscar apenas depth = 0 e carregar recursivo,
        // mas aqui vamos buscar ordenados pela criação e agrupar no frontend se houver paginação simples.
        const snapshot = await db.collection('reviews').doc(p.data.reviewId).collection('comments')
            .orderBy('createdAt', 'asc')
            .get();

        const comments = snapshot.docs.map(doc => sanitizeTimestamps({ id: doc.id, ...doc.data() }));

        res.json({ data: comments });
    } catch (error) {
        next(error);
    }
});

export default router;

// =============================================================================
// ROTAS DE ADMINISTRAÇÃO (ADMIN / LIBRARIAN)
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { db, admin } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { checkRole } from './middleware/roles.middleware';
import { reviewSuggestionSchema } from './schemas/books.schema';

const router = Router();

// Roles com acesso à curadoria de conteúdo
const CURATOR_ROLES = ['admin', 'librarian'] as const;

// =============================================================================
// VERIFICAÇÃO DE ACESSO (ENDPOINT LEVE PARA O FRONTEND)
// =============================================================================

/**
 * @route GET /api/curatorship/verify
 * @summary Verifica se o usuário autenticado tem acesso ao painel de curadoria.
 * @description Usado pelo adminLoader do frontend para determinar se o acesso
 * deve ser permitido sem depender de custom claims do Firebase Auth.
 */
router.get('/curatorship/verify', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const role = (req as any).userRole;
    logger.info('Verificação de acesso ao painel admin aprovada', { userId: authReq.user.uid, role });
    return res.status(200).json({ ok: true, role });
});

// =============================================================================
// SUGESTÕES DE CONTEÚDO (CURADORIA)
// =============================================================================

/**
 * @route GET /api/curatorship/suggestions
 * @summary Listar sugestões de conteúdo (admin/bibliotecário)
 */
router.get('/curatorship/suggestions', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const status = (req.query.status as string) || 'pending';
        const type = req.query.type as string | undefined;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

        // Busca toda a coleção — filtragem em memória evita a necessidade de
        // índices compostos (status + createdAt) que precisariam ser criados manualmente
        const snapshot = await db.collection('contentSuggestions').get();

        let all: any[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ?? null),
                resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : (data.resolvedAt ?? null),
            };
        });

        // Filtros em memória
        if (status !== 'all') {
            all = all.filter((s: any) => s.status === status);
        }
        if (type) {
            all = all.filter((s: any) => s.type === type);
        }

        // Ordenação por data desc
        all.sort((a: any, b: any) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
        });

        const total = all.length;
        const paginated = all.slice((page - 1) * limit, page * limit);

        return res.status(200).json({
            data: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/curatorship/suggestions/:id
 * @summary Detalhe de uma sugestão específica
 */
router.get('/curatorship/suggestions/:id', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) return res.status(400).json({ error: 'ID da sugestão é obrigatório' });

        const doc = await db.collection('contentSuggestions').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Sugestão não encontrada' });

        const data = doc.data()!;
        return res.status(200).json({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : data.resolvedAt,
        });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/curatorship/suggestions/:id/review
 * @summary Aprovar ou rejeitar uma sugestão de conteúdo
 */
router.patch('/curatorship/suggestions/:id/review', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) return res.status(400).json({ error: 'ID da sugestão é obrigatório' });

        const v = reviewSuggestionSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const doc = await db.collection('contentSuggestions').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Sugestão não encontrada' });

        const currentStatus = doc.data()?.status;
        if (currentStatus !== 'pending') {
            return res.status(409).json({ error: `Sugestão já foi ${currentStatus === 'approved' ? 'aprovada' : 'rejeitada'}` });
        }

        const timestamp = admin.firestore.Timestamp.now();
        const updatePayload: any = {
            status: v.data.status,
            reviewedBy: authReq.user.uid,
            reviewedByRole: (req as any).userRole,
            reviewNote: v.data.reviewNote || null,
            resolvedAt: timestamp,
        };

        if (v.data.updatedData) {
            // Salvará as modificações feitas pelo admin sobre o JSON original
            updatePayload.data = v.data.updatedData;
        }

        await db.collection('contentSuggestions').doc(id).update(updatePayload);

        logger.info(`Sugestão ${id} ${v.data.status} por ${authReq.user.uid}`);
        return res.status(200).json({
            message: v.data.status === 'approved' ? 'Sugestão aprovada com sucesso' : 'Sugestão rejeitada',
        });
    } catch (error) { return next(error); }
});

export default router;

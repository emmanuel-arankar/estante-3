// =============================================================================
// ROTAS DE ADMINISTRAÇÃO (ADMIN / LIBRARIAN)
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { db, admin } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { checkRole } from './middleware/roles.middleware';
import { 
    reviewSuggestionSchema,
    updateWorkSchema,
    updateEditionSchema,
    updatePersonSchema,
    updatePublisherSchema
} from './schemas/books.schema';
import { generateSearchTerms } from './lib/search';

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

        let createdEntityId: string | null = null;

        // ==== ==== STEP: PROMOÇÃO DE DADOS (Criação/Atualização Real) ==== ====
        if (v.data.status === 'approved') {
            const suggestion = doc.data()!;
            const finalData = v.data.updatedData || suggestion.data;
            const type = suggestion.type;

            try {
                if (type === 'work') {
                    const searchTerms = generateSearchTerms(
                        finalData.title,
                        finalData.originalTitle,
                        ...(finalData.primaryAuthors?.map((a: any) => a.name) || []),
                        ...(finalData.alternateNames?.map((a: any) => a.value) || [])
                    );
                    const docRef = await db.collection('works').add({
                        ...finalData,
                        searchTerms,
                        createdBy: suggestion.suggestedBy || suggestion.submittedBy || 'system',
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                    createdEntityId = docRef.id;
                } 
                else if (type === 'edition') {
                    const docRef = await db.collection('editions').add({
                        ...finalData,
                        createdBy: suggestion.suggestedBy || suggestion.submittedBy || 'system',
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                    createdEntityId = docRef.id;
                }
                else if (type === 'person') {
                    const searchTerms = generateSearchTerms(
                        finalData.name,
                        ...(finalData.alternateNames?.map((a: any) => a.value) || [])
                    );
                    const docRef = await db.collection('persons').add({
                        ...finalData,
                        searchTerms,
                        createdBy: suggestion.suggestedBy || suggestion.submittedBy || 'system',
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                    createdEntityId = docRef.id;
                }
                else if (type === 'publisher') {
                    const searchTerms = generateSearchTerms(
                        finalData.name,
                        ...(finalData.alternateNames?.map((a: any) => a.value) || [])
                    );
                    const docRef = await db.collection('publishers').add({
                        ...finalData,
                        searchTerms,
                        createdBy: suggestion.suggestedBy || suggestion.submittedBy || 'system',
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                    createdEntityId = docRef.id;
                }
                else if (type === 'series') {
                    const searchTerms = generateSearchTerms(finalData.name);
                    const docRef = await db.collection('series').add({
                        ...finalData,
                        searchTerms,
                        createdBy: suggestion.suggestedBy || suggestion.submittedBy || 'system',
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                    createdEntityId = docRef.id;
                }
                else if (type === 'correction' && suggestion.targetEntityId) {
                    const collectionMap: Record<string, string> = {
                        work: 'works', edition: 'editions', person: 'persons',
                        publisher: 'publishers', series: 'series'
                    };
                    const targetColl = collectionMap[finalData.entityType || suggestion.data?.entityType || ''];
                    if (targetColl) {
                        const updates: Record<string, any> = { 
                            ...finalData, 
                            updatedAt: timestamp 
                        };
                        // Remover campos de controle se vazarem para o payload
                        delete updates.entityType;
                        
                        await db.collection(targetColl).doc(suggestion.targetEntityId).update(updates);
                        logger.info(`Correção aplicada em ${targetColl}/${suggestion.targetEntityId}`);
                    }
                }

                if (createdEntityId) {
                    updatePayload.createdEntityId = createdEntityId;
                }
            } catch (promotionError: any) {
                logger.error('Erro crítico ao promover sugestão para entidade real:', promotionError);
                return res.status(500).json({ 
                    error: 'Falha ao persistir entidade aprovada', 
                    details: promotionError.message 
                });
            }
        }

        await db.collection('contentSuggestions').doc(id).update(updatePayload);

        // ==== ==== NOTIFICAÇÃO PARA O AUTOR DA SUGESTÃO ==== ====
        try {
            const suggestionData = doc.data()!;
            const submittedBy: string = suggestionData.submittedBy;

            if (submittedBy && submittedBy !== authReq.user.uid) {
                // Buscar nome do revisor
                const reviewerDoc = await db.collection('users').doc(authReq.user.uid).get();
                const reviewerData = reviewerDoc.data();
                const reviewerName = reviewerData?.displayName || reviewerData?.name || 'Bibliotecário';
                const reviewerPhoto = reviewerData?.photoURL || reviewerData?.photoUrl || '';

                // Título da sugestão (melhor esforço)
                const suggestionTitle =
                    suggestionData.data?.title ||
                    suggestionData.data?.name ||
                    suggestionData.title ||
                    suggestionData.name ||
                    'Conteúdo';

                const notificationPayload = {
                    userId: submittedBy,
                    type: v.data.status === 'approved' ? 'suggestion_approved' : 'suggestion_rejected',
                    actorId: authReq.user.uid,
                    actorName: reviewerName,
                    actorPhoto: reviewerPhoto,
                    read: false,
                    createdAt: timestamp,
                    metadata: {
                        suggestionId: id,
                        suggestionTitle,
                        reviewNote: v.data.reviewNote || null,
                    },
                };

                await db.collection('notifications').add(notificationPayload);
                logger.info(`Notificação de ${v.data.status} enviada para ${submittedBy}`);
            }
        } catch (notifError) {
            // Não bloqueia a resposta principal em caso de falha na notificação
            logger.warn('Falha ao criar notificação de revisão de sugestão:', notifError);
        }
        // ======================================================

        logger.info(`Sugestão ${id} ${v.data.status} por ${authReq.user.uid}`);
        return res.status(200).json({
            message: v.data.status === 'approved' ? 'Sugestão aprovada com sucesso' : 'Sugestão rejeitada',
            createdEntityId,
        });
    } catch (error) { return next(error); }
});
// =============================================================================
// EDIÇÃO DIRETA DE ENTIDADES (GESTAO)
// =============================================================================

/**
 * @route PATCH /api/curatorship/works/:id
 * @summary Editar uma Obra diretamente
 */
router.patch('/curatorship/works/:id', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const id = req.params.id as string;
        if (!id) return res.status(400).json({ error: 'ID da obra é obrigatório' });

        const v = updateWorkSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const docRef = db.collection('works').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Obra não encontrada' });

        const currentData = doc.data()!;
        const data = v.data;
        const updatePayload: any = { ...data, updatedAt: admin.firestore.Timestamp.now() };

        // Se título ou autores mudaram, atualiza searchTerms
        if (data.title || data.originalTitle || data.primaryAuthors || data.alternateNames) {
            const title = data.title || currentData.title;
            const originalTitle = data.originalTitle !== undefined ? data.originalTitle : currentData.originalTitle;
            const authors = data.primaryAuthors || currentData.primaryAuthors || [];
            const authorNames = authors.map((a: any) => a.name) || [];
            const altNames = data.alternateNames || currentData.alternateNames || [];
            updatePayload.searchTerms = generateSearchTerms(title, originalTitle, ...authorNames, ...(altNames.map((a: any) => a.value)));
        }

        await docRef.update(updatePayload);
        logger.info(`Obra ${id} atualizada diretamente pelo bibliotecário ${(req as AuthenticatedRequest).user.uid}`);
        return res.status(200).json({ message: 'Obra atualizada com sucesso' });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/curatorship/editions/:id
 * @summary Editar uma Edição diretamente
 */
router.patch('/curatorship/editions/:id', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const id = req.params.id as string;
        if (!id) return res.status(400).json({ error: 'ID da edição é obrigatório' });

        const v = updateEditionSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const docRef = db.collection('editions').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Edição não encontrada' });

        const updatePayload: any = { ...v.data, updatedAt: admin.firestore.Timestamp.now() };

        await docRef.update(updatePayload);
        logger.info(`Edição ${id} atualizada diretamente pelo bibliotecário ${(req as AuthenticatedRequest).user.uid}`);
        return res.status(200).json({ message: 'Edição atualizada com sucesso' });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/curatorship/persons/:id
 * @summary Editar uma Pessoa (Autor) diretamente
 */
router.patch('/curatorship/persons/:id', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const id = req.params.id as string;
        if (!id) return res.status(400).json({ error: 'ID da pessoa é obrigatório' });

        const v = updatePersonSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const docRef = db.collection('persons').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Pessoa não encontrada' });

        const currentData = doc.data()!;
        const data = v.data;
        const updatePayload: any = { ...data, updatedAt: admin.firestore.Timestamp.now() };

        if (data.name || data.alternateNames) {
            const name = data.name || currentData.name;
            const altNames = data.alternateNames || currentData.alternateNames || [];
            updatePayload.searchTerms = generateSearchTerms(name, ...(altNames.map((a: any) => a.value)));
        }

        await docRef.update(updatePayload);
        logger.info(`Pessoa ${id} atualizada diretamente pelo bibliotecário ${(req as AuthenticatedRequest).user.uid}`);
        return res.status(200).json({ message: 'Pessoa atualizada com sucesso' });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/curatorship/publishers/:id
 * @summary Editar uma Editora diretamente
 */
router.patch('/curatorship/publishers/:id', checkAuth, checkRole([...CURATOR_ROLES]), async (req: Request, res: Response, next: any) => {
    try {
        const id = req.params.id as string;
        if (!id) return res.status(400).json({ error: 'ID da editora é obrigatório' });

        const v = updatePublisherSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const docRef = db.collection('publishers').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Editora não encontrada' });

        const currentData = doc.data()!;
        const data = v.data;
        const updatePayload: any = { ...data, updatedAt: admin.firestore.Timestamp.now() };

        if (data.name || data.alternateNames) {
            const name = data.name || currentData.name;
            const altNames = data.alternateNames || currentData.alternateNames || [];
            updatePayload.searchTerms = generateSearchTerms(name, ...(altNames.map((a: any) => a.value)));
        }

        await docRef.update(updatePayload);
        logger.info(`Editora ${id} atualizada diretamente pelo bibliotecário ${(req as AuthenticatedRequest).user.uid}`);
        return res.status(200).json({ message: 'Editora atualizada com sucesso' });
    } catch (error) { return next(error); }
});

export default router;

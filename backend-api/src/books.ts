// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { admin, db } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { generateSearchTerms } from './lib/search';
import {
    createWorkSchema, searchWorksQuerySchema, workIdParamSchema,
    createEditionSchema, editionIdParamSchema, isbnParamSchema,
    createPersonSchema, personIdParamSchema,
    createGroupSchema, groupIdParamSchema,
    createPublisherSchema, createSeriesSchema,
    addToShelfSchema, updateShelfSchema, shelfItemIdParamSchema,
    listShelfQuerySchema, reorderShelfSchema,
    createProgressSchema, sessionIdParamSchema,
    createReviewSchema, reviewIdParamSchema,
    createCustomShelfSchema, createCustomTagSchema,
    createRecommendationSchema,
    userIdParamSchema,
} from './schemas/books.schema';

const router = Router();

// =============================================================================
// HELPERS
// =============================================================================

const sanitizeTimestamps = (data: any) => {
    const result = { ...data };
    for (const key of ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'achievedAt', 'resolvedAt']) {
        if (result[key]?.toDate) result[key] = result[key].toDate();
    }
    return result;
};

const now = () => admin.firestore.Timestamp.now();

// =============================================================================
// OBRAS (WORKS)
// =============================================================================

/**
 * @route GET /api/books/works/search
 * @summary Buscar obras por título/autor
 */
router.get('/books/works/search', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = searchWorksQuerySchema.safeParse(req.query);
        if (!v.success) return res.status(400).json({ error: 'Parâmetros inválidos', details: v.error.flatten().fieldErrors });

        const { q, page, limit } = v.data;
        const searchTerm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const snapshot = await db.collection('works')
            .where('searchTerms', 'array-contains', searchTerm)
            .limit(limit)
            .offset((page - 1) * limit)
            .get();

        const works = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json({ data: works, pagination: { page, limit, total: works.length } });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/works/:workId
 * @summary Detalhes de uma obra
 */
router.get('/books/works/:workId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = workIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'workId inválido' });

        const doc = await db.collection('works').doc(v.data.workId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Obra não encontrada' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/works
 * @summary Criar uma nova obra
 */
router.post('/books/works', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createWorkSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;

        // Buscar nomes dos autores
        const authorNames: string[] = [];
        for (let i = 0; i < data.primaryAuthorIds.length; i++) {
            const collection = data.primaryAuthorType[i] === 'group' ? 'authorGroups' : 'persons';
            const authorDoc = await db.collection(collection).doc(data.primaryAuthorIds[i]).get();
            authorNames.push(authorDoc.exists ? (authorDoc.data()?.name || 'Desconhecido') : 'Desconhecido');
        }

        // Buscar nomes dos gêneros
        const genreNames: string[] = [];
        for (const genreId of data.genreIds) {
            const genreDoc = await db.collection('genres').doc(genreId).get();
            genreNames.push(genreDoc.exists ? (genreDoc.data()?.name || genreId) : genreId);
        }

        const searchTerms = generateSearchTerms(data.title + ' ' + authorNames.join(' '));
        const timestamp = now();

        const workData = {
            ...data,
            primaryAuthorNames: authorNames,
            genreNames,
            coverUrl: null,
            averageRating: 0, ratingsCount: 0, reviewsCount: 0,
            readersCount: 0, currentlyReadingCount: 0, wantToReadCount: 0,
            editionsCount: 0,
            ratings5: 0, ratings4: 0, ratings3: 0, ratings2: 0, ratings1: 0,
            searchTerms,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('works').add(workData);
        logger.info(`Obra criada: ${docRef.id} por ${authReq.user.uid}`);

        return res.status(201).json({ id: docRef.id, message: 'Obra criada com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// EDIÇÕES (EDITIONS)
// =============================================================================

/**
 * @route GET /api/books/editions/check-isbn/:isbn
 * @summary Verificar se ISBN já existe
 */
router.get('/books/editions/check-isbn/:isbn', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = isbnParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'ISBN inválido' });

        const field = v.data.isbn.length === 13 ? 'isbn13' : 'isbn10';
        const snapshot = await db.collection('editions').where(field, '==', v.data.isbn).limit(1).get();

        return res.status(200).json({
            exists: !snapshot.empty,
            editionId: snapshot.empty ? null : snapshot.docs[0].id,
        });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/works/:workId/editions
 * @summary Listar edições de uma obra
 */
router.get('/books/works/:workId/editions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = workIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'workId inválido' });

        const snapshot = await db.collection('editions')
            .where('workId', '==', v.data.workId)
            .orderBy('publicationDate', 'desc')
            .get();

        const editions = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(editions);
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/editions/:editionId
 * @summary Detalhes de uma edição
 */
router.get('/books/editions/:editionId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = editionIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'editionId inválido' });

        const doc = await db.collection('editions').doc(v.data.editionId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Edição não encontrada' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/editions
 * @summary Criar uma nova edição
 */
router.post('/books/editions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createEditionSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;

        // Verificar se obra existe
        const workDoc = await db.collection('works').doc(data.workId).get();
        if (!workDoc.exists) return res.status(404).json({ error: 'Obra não encontrada' });

        // Verificar ISBN duplicado
        if (data.isbn13) {
            const existing = await db.collection('editions').where('isbn13', '==', data.isbn13).limit(1).get();
            if (!existing.empty) return res.status(409).json({ error: 'ISBN-13 já cadastrado' });
        }

        // Buscar nome da editora
        let publisherName: string | undefined;
        let imprintName: string | undefined;
        if (data.publisherId) {
            const pubDoc = await db.collection('publishers').doc(data.publisherId).get();
            publisherName = pubDoc.exists ? pubDoc.data()?.name : undefined;
            if (data.imprintId && pubDoc.exists) {
                const imprint = (pubDoc.data()?.imprints || []).find((i: any) => i.id === data.imprintId);
                imprintName = imprint?.name;
            }
        }

        const timestamp = now();
        const editionData = {
            ...data,
            publisherName, imprintName,
            averageRating: 0, ratingsCount: 0, reviewsCount: 0,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('editions').add(editionData);

        // Incrementar editionsCount na obra
        await db.collection('works').doc(data.workId).update({
            editionsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
        });

        logger.info(`Edição criada: ${docRef.id} para obra ${data.workId}`);
        return res.status(201).json({ id: docRef.id, message: 'Edição criada com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// PESSOAS (PERSONS)
// =============================================================================

/**
 * @route GET /api/books/persons/search
 * @summary Buscar pessoas
 */
router.get('/books/persons/search', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) return res.status(400).json({ error: 'Busca mínima: 2 caracteres' });

        const searchTerm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const snapshot = await db.collection('persons')
            .where('searchTerms', 'array-contains', searchTerm)
            .limit(20).get();

        const persons = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(persons);
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/persons/:personId
 * @summary Perfil de uma pessoa
 */
router.get('/books/persons/:personId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = personIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'personId inválido' });

        const doc = await db.collection('persons').doc(v.data.personId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Pessoa não encontrada' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/persons
 * @summary Criar pessoa (autor, tradutor, etc.)
 */
router.post('/books/persons', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createPersonSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;
        const searchTerms = generateSearchTerms(data.name);
        const timestamp = now();

        const personData = {
            ...data,
            worksCount: 0, followersCount: 0, searchTerms,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('persons').add(personData);
        logger.info(`Pessoa criada: ${docRef.id}`);
        return res.status(201).json({ id: docRef.id, message: 'Pessoa criada com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// GRUPOS DE AUTORES
// =============================================================================

/**
 * @route GET /api/books/groups/:groupId
 */
router.get('/books/groups/:groupId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = groupIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'groupId inválido' });

        const doc = await db.collection('authorGroups').doc(v.data.groupId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Grupo não encontrado' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/groups
 */
router.post('/books/groups', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createGroupSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;
        const memberNames: string[] = [];
        for (const memberId of data.memberIds) {
            const memberDoc = await db.collection('persons').doc(memberId).get();
            memberNames.push(memberDoc.exists ? (memberDoc.data()?.name || '') : '');
        }

        const searchTerms = generateSearchTerms(data.name + ' ' + memberNames.join(' '));
        const timestamp = now();

        const groupData = {
            ...data, memberNames,
            worksCount: 0, followersCount: 0, searchTerms,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('authorGroups').add(groupData);
        return res.status(201).json({ id: docRef.id, message: 'Grupo criado com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// EDITORAS
// =============================================================================

/**
 * @route GET /api/books/publishers/search
 * @summary Buscar editoras por nome
 */
router.get('/books/publishers/search', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) return res.status(400).json({ error: 'Busca mínima: 2 caracteres' });

        const searchTerm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const snapshot = await db.collection('publishers')
            .where('searchTerms', 'array-contains', searchTerm)
            .limit(20).get();

        const publishers = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(publishers);
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/publishers/:publisherId
 * @summary Detalhes de uma editora
 */
router.get('/books/publishers/:publisherId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const publisherId = req.params.publisherId as string;
        if (!publisherId) return res.status(400).json({ error: 'publisherId inválido' });

        const doc = await db.collection('publishers').doc(publisherId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Editora não encontrada' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/publishers
 */
router.post('/books/publishers', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createPublisherSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const timestamp = now();
        const data = v.data;

        // Gerar IDs para imprints
        const imprints = (data.imprints || []).map(imp => ({
            ...imp,
            id: db.collection('_').doc().id,
        }));

        const searchTerms = generateSearchTerms(data.name);

        const pubData = {
            ...data, imprints, searchTerms,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('publishers').add(pubData);
        return res.status(201).json({ id: docRef.id, message: 'Editora criada com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// SÉRIES
// =============================================================================

/**
 * @route GET /api/books/series/search
 * @summary Buscar séries por nome
 */
router.get('/books/series/search', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) return res.status(400).json({ error: 'Busca mínima: 2 caracteres' });

        const searchTerm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const snapshot = await db.collection('series')
            .where('searchTerms', 'array-contains', searchTerm)
            .limit(20).get();

        const series = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(series);
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/series/:seriesId
 * @summary Detalhes de uma série
 */
router.get('/books/series/:seriesId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const seriesId = req.params.seriesId as string;
        if (!seriesId) return res.status(400).json({ error: 'seriesId inválido' });

        const doc = await db.collection('series').doc(seriesId).get();
        if (!doc.exists) return res.status(404).json({ error: 'Série não encontrada' });

        return res.status(200).json({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/series
 */
router.post('/books/series', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createSeriesSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;
        let primaryAuthorName: string | undefined;
        if (data.primaryAuthorId) {
            const coll = data.primaryAuthorType === 'group' ? 'authorGroups' : 'persons';
            const authorDoc = await db.collection(coll).doc(data.primaryAuthorId).get();
            primaryAuthorName = authorDoc.exists ? authorDoc.data()?.name : undefined;
        }

        const searchTerms = generateSearchTerms(data.name as string);
        const timestamp = now();
        const seriesData: Record<string, any> = {
            ...data, primaryAuthorName, coverUrl: null,
            relatedSeriesIds: data.relatedSeriesIds || [],
            relatedSeriesNames: [] as string[],
            seriesType: data.seriesType || null,
            originalSeriesId: data.originalSeriesId || null,
            searchTerms,
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        // Buscar nomes das séries relacionadas
        if (data.relatedSeriesIds && data.relatedSeriesIds.length > 0) {
            const relatedNames: string[] = [];
            for (const relId of data.relatedSeriesIds) {
                const relDoc = await db.collection('series').doc(relId).get();
                relatedNames.push(relDoc.exists ? (relDoc.data()?.name || '') : '');
            }
            seriesData.relatedSeriesNames = relatedNames;
        }

        const docRef = await db.collection('series').add(seriesData);
        return res.status(201).json({ id: docRef.id, message: 'Série criada com sucesso' });
    } catch (error) { return next(error); }
});

// =============================================================================
// GÊNEROS
// =============================================================================

/**
 * @route GET /api/books/genres
 * @summary Listar todos os gêneros (hierárquico)
 */
router.get('/books/genres', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const snapshot = await db.collection('genres')
            .orderBy('name').get();

        const genres = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(genres);
    } catch (error) { return next(error); }
});


// =============================================================================
// ESTANTE DO USUÁRIO
// =============================================================================

/**
 * @route GET /api/books/shelf
 * @summary Minha estante
 */
router.get('/books/shelf', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user.uid;
        const v = listShelfQuerySchema.safeParse(req.query);
        if (!v.success) return res.status(400).json({ error: 'Parâmetros inválidos', details: v.error.flatten().fieldErrors });

        const { status, page, limit, sortBy, sortDirection } = v.data;
        let query: any = db.collection('userShelves').where('userId', '==', userId);
        if (status) query = query.where('status', '==', status);
        query = query.orderBy(sortBy, sortDirection).limit(limit).offset((page - 1) * limit);

        const snapshot = await query.get();
        const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));

        return res.status(200).json({ data: items, pagination: { page, limit } });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/shelf/:userId
 * @summary Estante de outro usuário
 */
router.get('/books/shelf/:userId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = userIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'userId inválido' });
        const qv = listShelfQuerySchema.safeParse(req.query);
        if (!qv.success) return res.status(400).json({ error: 'Parâmetros inválidos' });

        const { status, page, limit, sortBy, sortDirection } = qv.data;
        let query: any = db.collection('userShelves').where('userId', '==', v.data.userId);
        if (status) query = query.where('status', '==', status);
        query = query.orderBy(sortBy, sortDirection).limit(limit).offset((page - 1) * limit);

        const snapshot = await query.get();
        const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));

        return res.status(200).json({ data: items, pagination: { page, limit } });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/shelf
 * @summary Adicionar edição à estante
 */
router.post('/books/shelf', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user.uid;
        const v = addToShelfSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;
        const shelfId = `${userId}_${data.editionId}`;

        // Verificar se já está na estante
        const existing = await db.collection('userShelves').doc(shelfId).get();
        if (existing.exists) return res.status(409).json({ error: 'Livro já está na estante' });

        // Buscar dados da edição
        const editionDoc = await db.collection('editions').doc(data.editionId).get();
        if (!editionDoc.exists) return res.status(404).json({ error: 'Edição não encontrada' });
        const edition = editionDoc.data()!;

        // Buscar obra para dados desnormalizados
        const workDoc = await db.collection('works').doc(edition.workId).get();
        const work = workDoc.data();

        const timestamp = now();
        const shelfData = {
            userId, editionId: data.editionId,
            workId: edition.workId,
            status: data.status,
            rating: data.rating || null,
            timesRead: data.status === 'completed' ? 1 : 0,
            isFavorite: false,
            sortOrder: 0,
            tags: data.tags,
            customShelfIds: data.customShelfIds,
            customTagIds: data.customTagIds,
            bookTitle: edition.title || work?.title || '',
            bookCoverUrl: edition.coverUrl || work?.coverUrl || null,
            authorNames: work?.primaryAuthorNames || [],
            createdAt: timestamp, updatedAt: timestamp,
        };

        await db.collection('userShelves').doc(shelfId).set(shelfData);

        // Atualizar contadores na obra
        const statField = data.status === 'completed' ? 'readersCount'
            : data.status === 'reading' ? 'currentlyReadingCount'
                : data.status === 'want-to-read' ? 'wantToReadCount' : null;

        if (statField) {
            await db.collection('works').doc(edition.workId).update({
                [statField]: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp,
            });
        }

        // Criar sessão de leitura se status for 'reading' ou 'completed'
        if (data.status === 'reading' || data.status === 'completed') {
            await db.collection('readingSessions').add({
                shelfItemId: shelfId, userId, editionId: data.editionId,
                sessionNumber: 1,
                startedAt: timestamp,
                completedAt: data.status === 'completed' ? timestamp : null,
                status: data.status === 'completed' ? 'completed' : 'active',
                totalPages: edition.pages || null,
                currentPage: null, currentPercentage: null,
                createdAt: timestamp, updatedAt: timestamp,
            });
        }

        logger.info(`Livro adicionado à estante: ${shelfId}`);
        return res.status(201).json({ id: shelfId, message: 'Adicionado à estante' });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/books/shelf/:shelfItemId
 * @summary Atualizar item da estante
 */
router.patch('/books/shelf/:shelfItemId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const pv = shelfItemIdParamSchema.safeParse(req.params);
        if (!pv.success) return res.status(400).json({ error: 'shelfItemId inválido' });

        const v = updateShelfSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const docRef = db.collection('userShelves').doc(pv.data.shelfItemId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Item não encontrado' });
        if (doc.data()!.userId !== authReq.user.uid) return res.status(403).json({ error: 'Sem permissão' });

        await docRef.update({ ...v.data, updatedAt: now() });
        return res.status(200).json({ message: 'Estante atualizada' });
    } catch (error) { return next(error); }
});

/**
 * @route DELETE /api/books/shelf/:shelfItemId
 */
router.delete('/books/shelf/:shelfItemId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const pv = shelfItemIdParamSchema.safeParse(req.params);
        if (!pv.success) return res.status(400).json({ error: 'shelfItemId inválido' });

        const docRef = db.collection('userShelves').doc(pv.data.shelfItemId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Item não encontrado' });
        if (doc.data()!.userId !== authReq.user.uid) return res.status(403).json({ error: 'Sem permissão' });

        await docRef.delete();
        return res.status(200).json({ message: 'Removido da estante' });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/books/shelf/reorder
 * @summary Reordenar estante (batch)
 */
router.patch('/books/shelf/reorder', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = reorderShelfSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos' });

        const batch = db.batch();
        const timestamp = now();
        for (const item of v.data.items) {
            const ref = db.collection('userShelves').doc(item.shelfItemId);
            batch.update(ref, { sortOrder: item.sortOrder, updatedAt: timestamp });
        }
        await batch.commit();

        return res.status(200).json({ message: 'Estante reordenada' });
    } catch (error) { return next(error); }
});

// =============================================================================
// SESSÕES DE LEITURA + PROGRESSO
// =============================================================================

/**
 * @route POST /api/books/shelf/:shelfItemId/sessions
 * @summary Iniciar releitura
 */
router.post('/books/shelf/:shelfItemId/sessions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const pv = shelfItemIdParamSchema.safeParse(req.params);
        if (!pv.success) return res.status(400).json({ error: 'shelfItemId inválido' });

        const shelfDoc = await db.collection('userShelves').doc(pv.data.shelfItemId).get();
        if (!shelfDoc.exists) return res.status(404).json({ error: 'Item não encontrado' });
        if (shelfDoc.data()!.userId !== authReq.user.uid) return res.status(403).json({ error: 'Sem permissão' });

        // Contar sessões existentes
        const sessionsSnapshot = await db.collection('readingSessions')
            .where('shelfItemId', '==', pv.data.shelfItemId).get();

        const timestamp = now();
        const sessionData = {
            shelfItemId: pv.data.shelfItemId,
            userId: authReq.user.uid,
            editionId: shelfDoc.data()!.editionId,
            sessionNumber: sessionsSnapshot.size + 1,
            startedAt: timestamp, completedAt: null,
            status: 'active',
            totalPages: null, currentPage: null, currentPercentage: null,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('readingSessions').add(sessionData);

        // Atualizar status na estante
        await db.collection('userShelves').doc(pv.data.shelfItemId).update({
            status: 'reading', updatedAt: timestamp,
        });

        return res.status(201).json({ id: docRef.id, message: 'Releitura iniciada' });
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/sessions/:sessionId/progress
 * @summary Registrar progresso de leitura
 */
router.post('/books/sessions/:sessionId/progress', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const pv = sessionIdParamSchema.safeParse(req.params);
        if (!pv.success) return res.status(400).json({ error: 'sessionId inválido' });

        const v = createProgressSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const sessionDoc = await db.collection('readingSessions').doc(pv.data.sessionId).get();
        if (!sessionDoc.exists) return res.status(404).json({ error: 'Sessão não encontrada' });
        if (sessionDoc.data()!.userId !== authReq.user.uid) return res.status(403).json({ error: 'Sem permissão' });

        const timestamp = now();
        const progressData = {
            sessionId: pv.data.sessionId,
            userId: authReq.user.uid,
            page: v.data.page || null,
            percentage: v.data.percentage || null,
            comment: v.data.comment || null,
            createdAt: timestamp,
        };

        const docRef = await db.collection('progressUpdates').add(progressData);

        // Atualizar sessão
        const updateData: any = { updatedAt: timestamp };
        if (v.data.page) updateData.currentPage = v.data.page;
        if (v.data.percentage) updateData.currentPercentage = v.data.percentage;
        await db.collection('readingSessions').doc(pv.data.sessionId).update(updateData);

        return res.status(201).json({ id: docRef.id, message: 'Progresso registrado' });
    } catch (error) { return next(error); }
});

// =============================================================================
// REVIEWS
// =============================================================================

/**
 * @route GET /api/books/editions/:editionId/reviews
 */
router.get('/books/editions/:editionId/reviews', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = editionIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'editionId inválido' });

        const snapshot = await db.collection('reviews')
            .where('editionId', '==', v.data.editionId)
            .orderBy('createdAt', 'desc')
            .limit(20).get();

        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(reviews);
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/reviews
 */
router.post('/books/reviews', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user.uid;
        const v = createReviewSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const data = v.data;

        // Buscar edição e obra
        const editionDoc = await db.collection('editions').doc(data.editionId).get();
        if (!editionDoc.exists) return res.status(404).json({ error: 'Edição não encontrada' });
        const workId = editionDoc.data()!.workId;

        // Buscar dados do usuário
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        const timestamp = now();
        const reviewData = {
            userId, editionId: data.editionId, workId,
            rating: data.rating,
            userName: userData?.displayName || '',
            userNickname: userData?.nickname || '',
            userPhotoUrl: userData?.photoURL || null,
            title: data.title || null,
            content: data.content,
            containsSpoiler: data.containsSpoiler,
            likesCount: 0, commentsCount: 0,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('reviews').add(reviewData);

        // Atualizar contadores na edição e obra
        const ratingField = `ratings${Math.floor(data.rating)}` as string;
        const batch = db.batch();
        batch.update(db.collection('editions').doc(data.editionId), {
            reviewsCount: admin.firestore.FieldValue.increment(1),
            ratingsCount: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
        });
        batch.update(db.collection('works').doc(workId), {
            reviewsCount: admin.firestore.FieldValue.increment(1),
            ratingsCount: admin.firestore.FieldValue.increment(1),
            [ratingField]: admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
        });
        await batch.commit();

        return res.status(201).json({ id: docRef.id, message: 'Review criada' });
    } catch (error) { return next(error); }
});

/**
 * @route DELETE /api/books/reviews/:reviewId
 */
router.delete('/books/reviews/:reviewId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const pv = reviewIdParamSchema.safeParse(req.params);
        if (!pv.success) return res.status(400).json({ error: 'reviewId inválido' });

        const docRef = db.collection('reviews').doc(pv.data.reviewId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Review não encontrada' });
        if (doc.data()!.userId !== authReq.user.uid) return res.status(403).json({ error: 'Sem permissão' });

        await docRef.delete();
        return res.status(200).json({ message: 'Review excluída' });
    } catch (error) { return next(error); }
});

// =============================================================================
// PRATELEIRAS E TAGS PERSONALIZADAS
// =============================================================================

/**
 * @route POST /api/books/shelves
 */
router.post('/books/shelves', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createCustomShelfSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos' });

        const timestamp = now();
        const docRef = await db.collection('customShelves').add({
            ...v.data, userId: authReq.user.uid, bookCount: 0, sortOrder: 0,
            createdAt: timestamp, updatedAt: timestamp,
        });

        return res.status(201).json({ id: docRef.id, message: 'Prateleira criada' });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/shelves
 */
router.get('/books/shelves', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const snapshot = await db.collection('customShelves')
            .where('userId', '==', authReq.user.uid)
            .orderBy('sortOrder').get();

        const shelves = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(shelves);
    } catch (error) { return next(error); }
});

/**
 * @route POST /api/books/tags
 */
router.post('/books/tags', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createCustomTagSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos' });

        const docRef = await db.collection('customTags').add({
            ...v.data, userId: authReq.user.uid, bookCount: 0, createdAt: now(),
        });

        return res.status(201).json({ id: docRef.id, message: 'Tag criada' });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/tags
 */
router.get('/books/tags', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const snapshot = await db.collection('customTags')
            .where('userId', '==', authReq.user.uid).get();

        const tags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(tags);
    } catch (error) { return next(error); }
});

// =============================================================================
// RECOMENDAÇÕES
// =============================================================================

/**
 * @route POST /api/books/recommend
 */
router.post('/books/recommend', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createRecommendationSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos' });

        const data = v.data;
        const workDoc = await db.collection('works').doc(data.workId).get();
        if (!workDoc.exists) return res.status(404).json({ error: 'Obra não encontrada' });

        const userDoc = await db.collection('users').doc(authReq.user.uid).get();
        const timestamp = now();

        const docRef = await db.collection('bookRecommendations').add({
            senderId: authReq.user.uid,
            senderName: userDoc.data()?.displayName || '',
            receiverId: data.receiverId,
            workId: data.workId,
            editionId: data.editionId || null,
            workTitle: workDoc.data()!.title,
            workCoverUrl: workDoc.data()!.coverUrl || null,
            message: data.message || null,
            status: 'pending',
            createdAt: timestamp,
        });

        return res.status(201).json({ id: docRef.id, message: 'Recomendação enviada' });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/recommendations
 */
router.get('/books/recommendations', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const snapshot = await db.collection('bookRecommendations')
            .where('receiverId', '==', authReq.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(20).get();

        const recs = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));
        return res.status(200).json(recs);
    } catch (error) { return next(error); }
});

// =============================================================================
// EXPORTAÇÃO
// =============================================================================

export default router;

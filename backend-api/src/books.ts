// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { admin, db } from './firebase';
import { Filter } from 'firebase-admin/firestore';
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
    createRecommendationSchema, createSuggestionSchema, reviewSuggestionSchema,
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
 * @summary Buscar obras por título, autor, identificadores (ISBN/ASIN) ou perfil de pessoa (autor)
 */
router.get('/books/works/search', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = searchWorksQuerySchema.safeParse(req.query);
        if (!v.success) return res.status(400).json({ error: 'Parâmetros inválidos', details: v.error.flatten().fieldErrors });

        const { q, page, limit } = v.data;
        const searchTerm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Verifica se q pode ser um identificador (somente números/letras, tamanho compatível)
        const cleanQ = q.replace(/[-\s]/g, '').toUpperCase();
        const isPossibleIsbn = /^\d{10}$|^\d{13}$/.test(cleanQ);
        const isPossibleAsin = /^[A-Z0-9]{10}$/.test(cleanQ);

        // Conjunto (Set) para armazenar os IDs únicos das Obras que precisamos buscar no final
        const workIdsToFetch = new Set<string>();
        // Array para guardar as Obras que já vieram populadas das queries diretas (ex: busca por título)
        const worksFetchedDirectly = new Map<string, any>();

        const promises = [];

        // 1. Busca padrão em "works" (por título ou nome do autor em texto puro)
        promises.push(
            db.collection('works')
                .where('searchTerms', 'array-contains', searchTerm)
                .limit(50) // Limite folgado antes da paginação local
                .get()
                .then(snap => {
                    snap.docs.forEach(doc => {
                        workIdsToFetch.add(doc.id);
                        worksFetchedDirectly.set(doc.id, { id: doc.id, ...sanitizeTimestamps(doc.data()) });
                    });
                })
        );

        // 1.5 Fallback para Obras em Título Original exato (útil p/ idiomas CJK e obras antigas sem migração)
        if (q.trim()) {
            promises.push(
                db.collection('works')
                    .where('originalTitle', '==', q.trim())
                    .limit(10)
                    .get()
                    .then(snap => {
                        snap.docs.forEach(doc => {
                            workIdsToFetch.add(doc.id);
                            worksFetchedDirectly.set(doc.id, { id: doc.id, ...sanitizeTimestamps(doc.data()) });
                        });
                    })
            );
        }

        // 2. Busca por ISBN ou ASIN na coleção "editions"
        if (isPossibleIsbn || isPossibleAsin) {
            promises.push(
                db.collection('editions')
                    .where(Filter.or(
                        Filter.where('isbn13', '==', cleanQ),
                        Filter.where('isbn10', '==', cleanQ),
                        Filter.where('asin', '==', cleanQ)
                    ))
                    .limit(20)
                    .get()
                    .then(snap => {
                        snap.docs.forEach(doc => {
                            const data = doc.data();
                            if (data.workId) workIdsToFetch.add(data.workId);
                        });
                    })
            );
        }

        // 3. Busca por Autores na coleção "persons"
        // Se a busca principal for texto (e não estritamente ISBN)
        if (!isPossibleIsbn) {
            // Separa em dois steps: Acha persons -> acha works ligadas as essas persons
            const personPromise = db.collection('persons')
                .where('searchTerms', 'array-contains', searchTerm)
                .limit(10)
                .get()
                .then(async snap => {
                    const personIds = snap.docs.map(doc => doc.id);
                    if (personIds.length > 0) {
                        try {
                            const worksSnap = await db.collection('works')
                                .where('primaryAuthorIds', 'array-contains-any', personIds)
                                .limit(50)
                                .get();

                            worksSnap.docs.forEach(wDoc => {
                                workIdsToFetch.add(wDoc.id);
                                worksFetchedDirectly.set(wDoc.id, { id: wDoc.id, ...sanitizeTimestamps(wDoc.data()) });
                            });
                        } catch (e) {
                            // Silencioso se array-contains-any falhar
                        }
                    }
                });
            promises.push(personPromise);
        }

        // Aguarda todas as buscas finalizarem
        await Promise.all(promises);

        // Compila o Array final de Obras
        const finalWorks: any[] = [];
        const missingWorkIds = Array.from(workIdsToFetch).filter(id => !worksFetchedDirectly.has(id));

        // Se houver Obras que descobrimos apenas pelos IDs das edições (que não pegamos os dados ainda)
        if (missingWorkIds.length > 0) {
            // Emula chunkSize de 10 para getAll (Firestore limit)
            for (let i = 0; i < missingWorkIds.length; i += 10) {
                const chunk = missingWorkIds.slice(i, i + 10);
                const refs = chunk.map(id => db.collection('works').doc(id));
                const docs = await db.getAll(...refs);
                docs.forEach(doc => {
                    if (doc.exists) {
                        finalWorks.push({ id: doc.id, ...sanitizeTimestamps(doc.data()) });
                    }
                });
            }
        }

        // Adiciona as Obras que já baixamos diretamente
        for (const work of worksFetchedDirectly.values()) {
            finalWorks.push(work);
        }

        // Fallback de capa: Se a obra não tem capa, tenta pegar de uma edição
        await Promise.all(finalWorks.map(async (work) => {
            if (!work.coverUrl) {
                try {
                    // Removemos o orderBy para evitar a obrigatoriedade de um índice composto manual no Firestore.
                    // Pegamos as últimas 20 edições e ordenamos em memória se necessário.
                    const editionsSnap = await db.collection('editions')
                        .where('workId', '==', work.id)
                        .limit(20)
                        .get();
                    
                    if (!editionsSnap.empty) {
                        // Filtra as que têm capa e ordena pela mais recente (baseado no timestamp do doc se disponível)
                        const editions = editionsSnap.docs.map(doc => doc.data());
                        const withCover = editions
                            .filter(e => e.coverUrl)
                            .sort((a, b) => {
                                const ta = a.createdAt?.seconds || 0;
                                const tb = b.createdAt?.seconds || 0;
                                return tb - ta;
                            });
                        
                        if (withCover.length > 0) {
                            work.fallbackCoverUrl = withCover[0].coverUrl;
                        }
                    }
                } catch (e) {
                    // Silencioso
                }
            }
        }));

        // Paginação Manual (em memória)
        const total = finalWorks.length;
        const startIndex = (page - 1) * limit;
        const paginatedWorks = finalWorks.slice(startIndex, startIndex + limit);

        return res.status(200).json({ data: paginatedWorks, pagination: { page, limit, total } });
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

        const authorNames = data.primaryAuthors.map(a => a.name) || [];

        const searchTerms = generateSearchTerms(data.title, data.originalTitle, ...authorNames, ...(data.alternateNames?.map(a => a.value) || []));
        const timestamp = now();

        const workData = {
            ...data,
            coverUrl: null,
            stats: {
                averageRating: 0, ratingsCount: 0, reviewsCount: 0,
                readersCount: 0, currentlyReadingCount: 0, wantToReadCount: 0,
                editionsCount: 0,
                ratings5: 0, ratings4: 0, ratings3: 0, ratings2: 0, ratings1: 0,
            },
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
            edition: snapshot.empty ? null : { id: snapshot.docs[0].id, ...sanitizeTimestamps(snapshot.docs[0].data()) },
        });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/editions/enrich-isbn/:isbn
 * @summary Enriquecer dados de um ISBN via Google Books e Open Library
 * @description Consulta APIs externas para obter metadados de um livro pelo ISBN.
 *              Estratégia: Google Books → Open Library (fallback).
 */
router.get('/books/editions/enrich-isbn/:isbn', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = isbnParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'ISBN inválido' });

        const convertIsbn13To10 = (isbn13: string): string | null => {
            if (isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
            const core = isbn13.substring(3, 12);
            let sum = 0;
            for (let i = 0; i < 9; i++) {
                sum += parseInt(core[i]) * (10 - i);
            }
            const rem = sum % 11;
            const checkDigit = rem === 0 ? '0' : rem === 1 ? 'X' : (11 - rem).toString();
            return core + checkDigit;
        };

        const convertIsbn10To13 = (isbn10: string): string | null => {
            if (isbn10.length !== 10) return null;
            const core = '978' + isbn10.substring(0, 9);
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                const weight = i % 2 === 0 ? 1 : 3;
                sum += parseInt(core[i]) * weight;
            }
            const rem = sum % 10;
            const checkDigit = rem === 0 ? 0 : 10 - rem;
            return core + checkDigit.toString();
        };
        const isbn = v.data.isbn;

        // ==== ==== STEP 1: Brasil API (Primário) ==== ====
        let enriched: Record<string, any> | null = null;
        try {
            const brasilApiUrl = `https://brasilapi.com.br/api/isbn/v1/${isbn}`;
            const brasilRes = await fetch(brasilApiUrl);
            
            if (brasilRes.ok) {
                const brasilData = await brasilRes.json() as any;
                
                enriched = {
                    source: `brasil_api_${brasilData.provider || ''}`.trim().toLowerCase(),
                    title: brasilData.title || null,
                    subtitle: brasilData.subtitle || null,
                    description: brasilData.synopsis || null,
                    authors: (brasilData.authors || []).map((a: string) => ({ name: a, role: 'author' })),
                    publisher: brasilData.publisher || null,
                    publicationDate: brasilData.year ? `${brasilData.year}` : null,
                    pages: brasilData.page_count || null,
                    language: 'pt-BR', // Brasil API assume literatura BR ou pelo menos mercado BR
                    coverUrl: brasilData.cover_url || null,
                    isbn13: isbn.length === 13 ? isbn : (isbn.length === 10 ? convertIsbn10To13(isbn) : null),
                    isbn10: isbn.length === 10 ? isbn : (isbn.length === 13 && isbn.startsWith('978') ? convertIsbn13To10(isbn) : null),
                    categories: brasilData.subjects || [],
                    
                    // Novos campos estendidos:
                    format: brasilData.format || null,
                    dimensions: brasilData.dimensions ? {
                        width: brasilData.dimensions.width || undefined,
                        height: brasilData.dimensions.height || undefined,
                    } : undefined,
                    weight: undefined, // Brasil API não costuma retornar weight, mas abrimos o campo
                };
            }
        } catch (err) {
            logger.warn('Brasil API falhou, tentando fallback', err);
        }

        // ==== ==== STEP 2: Google Books API (Fallback / Complemento) ==== ====
        // Só entramos aqui se a Brasil API falhar ou vier muito incompleta (ex: sem capa ou editora)
        const needsGoogleComplement = !enriched || !enriched.publisher || !enriched.coverUrl || !enriched.description;
        
        let googleDataFound = null;
        if (needsGoogleComplement) {
            try {
                const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
                const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${googleKey ? `&key=${googleKey}` : ''}`;
                const googleRes = await fetch(googleUrl);
                const googleData = await googleRes.json() as any;

                if (googleData.totalItems > 0) {
                    googleDataFound = googleData.items[0].volumeInfo;
                    const item = googleDataFound;
                    const identifiers: Record<string, string> = {};
                    for (const id of (item.industryIdentifiers || [])) {
                        identifiers[id.type] = id.identifier;
                    }
                    
                    if (!enriched) {
                        enriched = {
                            source: 'google_books',
                            title: item.title || null,
                            subtitle: item.subtitle || null,
                            description: item.description || null,
                            authors: (item.authors || []).map((a: string) => ({ name: a, role: 'author' })),
                            publisher: item.publisher || null,
                            publicationDate: item.publishedDate || null,
                            pages: item.pageCount || null,
                            language: item.language || null,
                            coverUrl: item.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                            isbn13: identifiers['ISBN_13'] || (isbn.length === 13 ? isbn : null),
                            isbn10: identifiers['ISBN_10'] || (isbn.length === 10 ? isbn : null),
                            categories: item.categories || [],
                        };
                    } else {
                        // Complementando o que a Brasil API talvez tenha deixado de fora
                        if (!enriched.description && item.description) enriched.description = item.description;
                        if (!enriched.publisher && item.publisher) enriched.publisher = item.publisher;
                        if (!enriched.coverUrl && item.imageLinks?.thumbnail) enriched.coverUrl = item.imageLinks.thumbnail.replace('http:', 'https:');
                        if (!enriched.publicationDate && item.publishedDate) enriched.publicationDate = item.publishedDate; // Provavelmente YYYY-MM-DD, melhor que só YYYY da Brasil API
                    }
                }
            } catch (err) {
                logger.warn('Google Books API falhou', err);
            }
        }

        // ==== ==== STEP 3: Open Library — Último recurso se Google e Brasil API falharem ==== ====
        const needsOLComplement = !enriched || !enriched.publisher || !enriched.pages || !enriched.coverUrl;
        if (needsOLComplement) {
            try {
                const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
                const olRes = await fetch(olUrl);
                const olData = await olRes.json() as any;
                const key = `ISBN:${isbn}`;

                if (olData[key]) {
                    const book = olData[key];
                    const olIdentifiers = book.identifiers || {};
                    const olIsbn13 = (olIdentifiers.isbn_13 && olIdentifiers.isbn_13[0]) || (isbn.length === 13 ? isbn : null);
                    const olIsbn10 = (olIdentifiers.isbn_10 && olIdentifiers.isbn_10[0]) || (isbn.length === 10 ? isbn : null);
                    const olPublisher = (book.publishers || [])[0]?.name || null;

                    if (!enriched) {
                        enriched = {
                            source: 'open_library',
                            title: book.title || null,
                            subtitle: book.subtitle || null,
                            description: book.notes?.value || (typeof book.notes === 'string' ? book.notes : null),
                            authors: (book.authors || []).map((a: any) => ({ name: a.name, role: 'author' })),
                            publisher: olPublisher,
                            publicationDate: book.publish_date || null,
                            pages: book.number_of_pages || null,
                            language: null,
                            coverUrl: book.cover?.large || book.cover?.medium || null,
                            isbn13: olIsbn13,
                            isbn10: olIsbn10,
                            categories: (book.subjects || []).slice(0, 5).map((s: any) => s.name || s),
                        };
                    } else {
                        if (!enriched.publisher && olPublisher) enriched.publisher = olPublisher;
                        if (!enriched.pages && book.number_of_pages) enriched.pages = book.number_of_pages;
                        if (!enriched.coverUrl) enriched.coverUrl = book.cover?.large || book.cover?.medium || null;
                        if (!enriched.publicationDate && book.publish_date) enriched.publicationDate = book.publish_date;
                    }
                }
            } catch (err) {
                logger.warn('Open Library API também falhou', err);
            }
        }

        if (!enriched) {
            return res.status(404).json({ error: 'Nenhum dado encontrado para este ISBN' });
        }

        return res.status(200).json(enriched);
    } catch (error) { return next(error); }
});

// =============================================================================
// SUGESTÕES DE CONTEÚDO
// =============================================================================

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
            .get();

        const language = req.query.language as string;
        const formatId = req.query.formatId as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 100;

        let editions = snapshot.docs.map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));

        // Filtragem em memória
        if (language) {
            editions = editions.filter((ed: any) => ed.language === language);
        }
        if (formatId) {
            editions = editions.filter((ed: any) => ed.formatId === formatId);
        }

        const sortBy = req.query.sortBy as string || 'date_published';
        const sortDirection = req.query.sortDirection as string || 'desc';

        editions.sort((a: any, b: any) => {
            let result = 0;
            switch (sortBy) {
                case 'title':
                    result = a.title.localeCompare(b.title);
                    break;
                case 'avg_rating':
                    result = (a.stats?.averageRating || 0) - (b.stats?.averageRating || 0);
                    break;
                case 'num_ratings':
                    result = (a.stats?.ratingsCount || 0) - (b.stats?.ratingsCount || 0);
                    break;
                case 'format':
                    result = (a.formatId || '').localeCompare(b.formatId || '');
                    break;
                case 'date_published':
                default:
                    const dateA = a.publicationDate || '';
                    const dateB = b.publicationDate || '';
                    result = dateA.localeCompare(dateB);
                    break;
            }
            // Multiplicar por -1 se a direção for decrescente (desc)
            // Nota: Para datas e ratings, 'desc' geralmente é o padrão desejado (mais novos/maiores primeiro)
            return sortDirection === 'desc' ? -result : result;
        });

        const total = editions.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedData = editions.slice((page - 1) * limit, page * limit);

        // Injetar nota do usuário atual (se houver)
        const currentUserId = (req as any).user?.uid;
        if (currentUserId && paginatedData.length > 0) {
            // Pegar o workId REAL de um documento de edição (pode ser diferente do slug na URL)
            const realWorkId = typeof paginatedData[0].workId === 'string' 
                ? paginatedData[0].workId 
                : paginatedData[0].workId?.id;

            if (realWorkId) {
                const reviewsSnap = await db.collection('reviews')
                    .where('userId', '==', currentUserId)
                    .where('workId', '==', realWorkId)
                    .limit(1)
                    .get();
                
                if (!reviewsSnap.empty) {
                    const userRating = reviewsSnap.docs[0].data().rating;
                    paginatedData.forEach((ed: any) => {
                        ed.userRating = userRating;
                    });
                }
            }
        }

        return res.status(200).json({
            data: paginatedData,
            pagination: { page, limit, total, totalPages }
        });
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


        const timestamp = now();
        const editionData = {
            ...data,
            stats: { averageRating: 0, ratingsCount: 0, reviewsCount: 0 },
            createdBy: authReq.user.uid,
            createdAt: timestamp, updatedAt: timestamp,
        };

        const docRef = await db.collection('editions').add(editionData);

        // Incrementar editionsCount na obra
        await db.collection('works').doc(data.workId).update({
            'stats.editionsCount': admin.firestore.FieldValue.increment(1),
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
 * @route GET /api/books/persons/:personId/editions
 * @summary Buscar edições relacionadas a uma pessoa
 */
router.get('/books/persons/:personId/editions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = personIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'personId inválido' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const snapshot = await db.collection('editions').orderBy('createdAt', 'desc').get();
        let editions = snapshot.docs
            .map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }))
            .filter((ed: any) => ed.contributors && ed.contributors.some((c: any) => c.personId === v.data.personId));

        return res.status(200).json({
            data: editions.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total: editions.length, totalPages: Math.ceil(editions.length / limit) }
        });
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
        const searchTerms = generateSearchTerms(data.name, ...(data.alternateNames?.map(a => a.value) || []));
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
 * @route GET /api/books/groups/:groupId/editions
 */
router.get('/books/groups/:groupId/editions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const v = groupIdParamSchema.safeParse(req.params);
        if (!v.success) return res.status(400).json({ error: 'groupId inválido' });

        const snapshot = await db.collection('editions').orderBy('createdAt', 'desc').get();
        let editions = snapshot.docs
            .map(doc => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }))
            .filter((ed: any) => ed.contributors && ed.contributors.some((c: any) => c.groupId === v.data.groupId));

        return res.status(200).json({ data: editions });
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

        const searchTerms = generateSearchTerms(data.name, ...(data.alternateNames?.map(a => a.value) || []));

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
        const searchTerms = generateSearchTerms(data.name as string, ...(data.alternateNames?.map(a => a.value) || []));
        const timestamp = now();
        const seriesData: Record<string, any> = {
            ...data, coverUrl: null,
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
        const statField = data.status === 'completed' ? 'stats.readersCount'
            : data.status === 'reading' ? 'stats.currentlyReadingCount'
                : data.status === 'want-to-read' ? 'stats.wantToReadCount' : null;

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
        const batch = db.batch();
        const editionUpdates: any = {
            'stats.reviewsCount': admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
        };
        const workUpdates: any = {
            'stats.reviewsCount': admin.firestore.FieldValue.increment(1),
            updatedAt: timestamp,
        };

        if (typeof data.rating === 'number') {
            editionUpdates['stats.ratingsCount'] = admin.firestore.FieldValue.increment(1);
            workUpdates['stats.ratingsCount'] = admin.firestore.FieldValue.increment(1);
            workUpdates[`stats.ratings${Math.floor(data.rating)}`] = admin.firestore.FieldValue.increment(1);
        }

        batch.update(db.collection('editions').doc(data.editionId), editionUpdates);
        batch.update(db.collection('works').doc(workId), workUpdates);
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
// SUGESTÕES DE CONTEÚDO
// =============================================================================

/**
 * @route POST /api/books/suggestions
 * @summary Criar sugestão de nova entidade ou correção de dados existentes
 * @description Qualquer usuário autenticado pode sugerir novos livros, autores,
 *              editoras, séries ou correções em dados já cadastrados.
 */
router.post('/books/suggestions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const v = createSuggestionSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const timestamp = now();
        const suggestionData = {
            ...v.data,
            suggestedBy: authReq.user.uid,
            suggestedByName: authReq.user.name || authReq.user.email || 'Usuário',
            status: 'pending',
            createdAt: timestamp,
        };

        const docRef = await db.collection('contentSuggestions').add(suggestionData);
        logger.info(`Sugestão criada: ${docRef.id} por ${authReq.user.uid} (tipo: ${v.data.type})`);

        return res.status(201).json({ id: docRef.id, message: 'Sugestão enviada com sucesso e aguarda revisão' });
    } catch (error) { return next(error); }
});

/**
 * @route GET /api/books/suggestions
 * @summary Listar sugestões pendentes (bibliotecário/admin)
 */
router.get('/books/suggestions', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        // Apenas bibliotecários e admins podem listar sugestões
        if (!['librarian', 'admin'].includes(authReq.user.role || '')) {
            return res.status(403).json({ error: 'Acesso restrito a bibliotecários' });
        }

        const status = (req.query.status as string) || 'pending';
        const type = req.query.type as string | undefined;
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

        let query: any = db.collection('contentSuggestions').where('status', '==', status);
        if (type) query = query.where('type', '==', type);
        query = query.orderBy('createdAt', 'desc').limit(limit).offset((page - 1) * limit);

        const snapshot = await query.get();
        const suggestions = snapshot.docs.map((doc: any) => ({ id: doc.id, ...sanitizeTimestamps(doc.data()) }));

        return res.status(200).json({ data: suggestions, pagination: { page, limit } });
    } catch (error) { return next(error); }
});

/**
 * @route PATCH /api/books/suggestions/:suggestionId
 * @summary Aprovar ou rejeitar uma sugestão (bibliotecário/admin)
 * @description Ao aprovar uma sugestão de edição, cria a entidade no banco automaticamente.
 *              Sugestões de correção aplicam as mudanças campo a campo.
 */
router.patch('/books/suggestions/:suggestionId', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        if (!['librarian', 'admin'].includes(authReq.user.role || '')) {
            return res.status(403).json({ error: 'Acesso restrito a bibliotecários' });
        }

        const suggestionId = req.params.suggestionId as string;
        if (!suggestionId) return res.status(400).json({ error: 'suggestionId inválido' });

        const v = reviewSuggestionSchema.safeParse(req.body);
        if (!v.success) return res.status(400).json({ error: 'Dados inválidos', details: v.error.flatten().fieldErrors });

        const suggestionDoc = await db.collection('contentSuggestions').doc(String(suggestionId)).get();
        if (!suggestionDoc.exists) return res.status(404).json({ error: 'Sugestão não encontrada' });

        const suggestion = suggestionDoc.data()!;
        if (suggestion.status !== 'pending') return res.status(409).json({ error: 'Sugestão já foi processada' });

        const timestamp = now();
        let createdEntityId: string | null = null;

        // ==== ==== STEP: Aprovação — criar entidade ou aplicar correção ==== ====
        if (v.data.status === 'approved') {
            if (suggestion.type === 'correction' && suggestion.targetEntityId && suggestion.corrections) {
                // Determinar coleção alvo pela propriedade data.entityType
                const collectionMap: Record<string, string> = {
                    work: 'works', edition: 'editions', person: 'persons',
                    group: 'authorGroups', publisher: 'publishers', series: 'series',
                };
                const targetColl = collectionMap[suggestion.data?.entityType || ''];
                if (targetColl) {
                    const updates: Record<string, any> = { updatedAt: timestamp };
                    for (const correction of suggestion.corrections) {
                        updates[correction.field] = correction.newValue;
                    }
                    await db.collection(targetColl).doc(suggestion.targetEntityId).update(updates);
                    logger.info(`Correção aplicada em ${targetColl}/${suggestion.targetEntityId}`);
                }
            } else if (suggestion.type === 'series' && suggestion.data) {
                // Criar série automaticamente
                const searchTerms = generateSearchTerms(suggestion.data.name as string);
                const seriesRef = await db.collection('series').add({
                    ...suggestion.data,
                    searchTerms,
                    createdBy: suggestion.suggestedBy,
                    createdAt: timestamp, updatedAt: timestamp,
                });
                createdEntityId = seriesRef.id;
            }
            // Outros tipos (work, edition, person) requerem preenchimento pelo bibliotecário
            // via interface administrativa — a sugestão serve como rascunho
        }

        // ==== ==== STEP: Atualizar status da sugestão ==== ====
        await db.collection('contentSuggestions').doc(String(suggestionId)).update({
            status: v.data.status,
            reviewNote: v.data.reviewNote || null,
            reviewedBy: authReq.user.uid,
            reviewedByName: authReq.user.name || authReq.user.email,
            resolvedAt: timestamp,
            ...(createdEntityId ? { createdEntityId } : {}),
        });

        logger.info(`Sugestão ${suggestionId} ${v.data.status} por ${authReq.user.uid}`);
        return res.status(200).json({
            message: `Sugestão ${v.data.status === 'approved' ? 'aprovada' : 'rejeitada'}`,
            createdEntityId,
        });
    } catch (error) { return next(error); }
});

// =============================================================================
// EXPORTAÇÃO
// =============================================================================

export default router;

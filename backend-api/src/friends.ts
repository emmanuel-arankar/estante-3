import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { admin, db } from './firebase'; // Importa do nosso módulo centralizado
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import {
  findFriendsQuerySchema,
  sendFriendRequestSchema,
  friendshipIdParamSchema,
  friendshipStatusParamSchema,
  listFriendsQuerySchema,
  listRequestsQuerySchema,
  bulkFriendshipSchema
} from './schemas/friends.schema';
import { blockUserSchema, unblockUserSchema } from './schemas/blocking.schema';
import { getCached, setCache, invalidatePattern, CacheKeys } from './lib/cache';
import { ensureNotBlocked, isBlockedBy } from './services/block.service';

const router = Router();

const FIND_FRIENDS_LIMIT = parseInt(process.env.FIND_FRIENDS_QUERY_LIMIT || '', 10) || 10;
logger.info(`Usando limite de busca de amigos: ${FIND_FRIENDS_LIMIT}`);

// ==================== HELPERS DE AMIGOS EM COMUM ====================

/**
 * Calcula amigos em comum entre dois usuários
 * Retorna count e preview (primeiros 3 amigos)
 */
const calculateMutualFriends = async (
  userId1: string,
  userId2: string
): Promise<{ count: number; preview: string[] }> => {
  const [friends1Snapshot, friends2Snapshot] = await Promise.all([
    db.collection('friendships')
      .where('userId', '==', userId1)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
    db.collection('friendships')
      .where('userId', '==', userId2)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
  ]);

  const friends1Set = new Set(friends1Snapshot.docs.map(doc => doc.data().friendId));
  const mutualIds: string[] = [];

  for (const doc of friends2Snapshot.docs) {
    const friendId = doc.data().friendId;
    if (friends1Set.has(friendId)) {
      mutualIds.push(friendId);
    }
  }

  return {
    count: mutualIds.length,
    preview: mutualIds.slice(0, 3), // Primeiros 3 para preview
  };
};

/**
 * Atualiza mutualFriendsCount para todas as amizades afetadas
 * quando uma nova amizade é criada entre userId1 e userId2
 */
const updateMutualFriendsForNewFriendship = async (
  userId1: string,
  userId2: string
): Promise<void> => {
  // Buscar amigos em comum (que agora têm +1 mútuo entre si)
  const [friends1Snapshot, friends2Snapshot] = await Promise.all([
    db.collection('friendships')
      .where('userId', '==', userId1)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
    db.collection('friendships')
      .where('userId', '==', userId2)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
  ]);

  const friends1Set = new Set(friends1Snapshot.docs.map(doc => doc.data().friendId));
  const mutualFriendIds: string[] = [];

  for (const doc of friends2Snapshot.docs) {
    const friendId = doc.data().friendId;
    if (friends1Set.has(friendId)) {
      mutualFriendIds.push(friendId);
    }
  }

  if (mutualFriendIds.length === 0) return;

  // Atualizar amizades afetadas em lotes
  // Para cada amigo em comum M, as amizades M-userId1 e M-userId2 agora têm +1 mútuo
  const batch = db.batch();
  const timestamp = admin.firestore.Timestamp.now();

  for (const mutualId of mutualFriendIds) {
    // Amizade M ↔ userId1: agora têm userId2 como mútuo adicional
    const ref1a = db.collection('friendships').doc(`${mutualId}_${userId1}`);
    const ref1b = db.collection('friendships').doc(`${userId1}_${mutualId}`);
    batch.update(ref1a, {
      mutualFriendsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    });
    batch.update(ref1b, {
      mutualFriendsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    });

    // Amizade M ↔ userId2: agora têm userId1 como mútuo adicional
    const ref2a = db.collection('friendships').doc(`${mutualId}_${userId2}`);
    const ref2b = db.collection('friendships').doc(`${userId2}_${mutualId}`);
    batch.update(ref2a, {
      mutualFriendsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    });
    batch.update(ref2b, {
      mutualFriendsCount: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    });
  }

  await batch.commit();
  logger.info(`Atualizado mutualFriendsCount para ${mutualFriendIds.length * 4} amizades afetadas`);
};

/**
 * Atualiza mutualFriendsCount para todas as amizades afetadas
 * quando uma amizade é removida entre userId1 e userId2
 */
const updateMutualFriendsForRemovedFriendship = async (
  userId1: string,
  userId2: string
): Promise<void> => {
  // Buscar amigos que eram mútuos (agora têm -1 mútuo entre si)
  const [friends1Snapshot, friends2Snapshot] = await Promise.all([
    db.collection('friendships')
      .where('userId', '==', userId1)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
    db.collection('friendships')
      .where('userId', '==', userId2)
      .where('status', '==', 'accepted')
      .select('friendId')
      .get(),
  ]);

  const friends1Set = new Set(friends1Snapshot.docs.map(doc => doc.data().friendId));
  const mutualFriendIds: string[] = [];

  for (const doc of friends2Snapshot.docs) {
    const friendId = doc.data().friendId;
    if (friends1Set.has(friendId)) {
      mutualFriendIds.push(friendId);
    }
  }

  if (mutualFriendIds.length === 0) return;

  const batch = db.batch();
  const timestamp = admin.firestore.Timestamp.now();

  for (const mutualId of mutualFriendIds) {
    // Decrementar para amizades M ↔ userId1 e M ↔ userId2
    const refs = [
      db.collection('friendships').doc(`${mutualId}_${userId1}`),
      db.collection('friendships').doc(`${userId1}_${mutualId}`),
      db.collection('friendships').doc(`${mutualId}_${userId2}`),
      db.collection('friendships').doc(`${userId2}_${mutualId}`),
    ];

    for (const ref of refs) {
      batch.update(ref, {
        mutualFriendsCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: timestamp,
      });
    }
  }

  await batch.commit();
  logger.info(`Decrementado mutualFriendsCount para ${mutualFriendIds.length * 4} amizades afetadas`);
};

// Lógica de busca dupla (nome e nickname)
router.get('/findFriends', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const loggedInUserId = authReq.user.uid;

    // Validar req.query usando o schema
    const validationResult = findFriendsQuerySchema.safeParse(req.query);

    if (!validationResult.success) {
      logger.warn('Falha na validação da busca de amigos', {
        userId: loggedInUserId,
        errors: validationResult.error.flatten().fieldErrors,
        query: req.query
      });
      return res.status(400).json({
        error: 'Dados de busca inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { searchTerm } = validationResult.data;
    logger.info('Iniciando busca de amigos', { userId: loggedInUserId, searchTerm });

    const endTerm = searchTerm + '\uf8ff';
    const usersRef = admin.firestore().collection('users');
    const queryLimit = FIND_FRIENDS_LIMIT;

    // Query 1: Buscar por displayName
    const nameQuery = usersRef
      .where('displayName', '>=', searchTerm)
      .where('displayName', '<=', endTerm)
      .limit(queryLimit);

    // Query 2: Buscar por nickname
    // Remove o '@' se o usuário digitou, para buscar no campo 'nickname'
    const nicknameSearch = searchTerm.startsWith('@')
      ? searchTerm.substring(1)
      : searchTerm;
    const endNicknameTerm = nicknameSearch + '\uf8ff';

    const nicknameQuery = usersRef
      .where('nickname', '>=', nicknameSearch)
      .where('nickname', '<=', endNicknameTerm)
      .limit(queryLimit);

    // Executar ambas as queries em paralelo
    const [nameSnapshot, nicknameSnapshot] = await Promise.all([
      nameQuery.get(),
      nicknameQuery.get(),
    ]);

    // Usar um Map para mesclar resultados e remover duplicatas
    const usersMap = new Map();

    // Adicionar resultados da busca por nome
    nameSnapshot.docs.forEach(doc => {
      if (doc.id !== loggedInUserId) { // Filtra o usuário logado
        usersMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    // Adicionar resultados da busca por nickname (sobrescreve duplicatas)
    nicknameSnapshot.docs.forEach(doc => {
      if (doc.id !== loggedInUserId) { // Filtra o usuário logado
        usersMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    // Converter o Map de volta para um array
    const users = Array.from(usersMap.values());
    logger.info(`Busca de amigos concluída para ${loggedInUserId}. Retornando ${users.length} resultados.`);
    return res.status(200).json(users);
  } catch (error) {
    logger.error('Erro interno do servidor ao buscar amigos:', error);
    // Retornar erro como JSON
    return next(error);
  }
});

// ==================== LISTAGEM DE AMIZADES ====================

/**
 * GET /api/friendships
 * Lista amigos aceitos com paginação, busca e ordenação
 */
router.get('/friendships', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = listFriendsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { page, limit, search, sortBy, sortDirection, cursor } = validationResult.data;

    const cacheKey = CacheKeys.friends(userId, 1); // Cache apenas da página 1 padrão

    // Tentar buscar do cache (apenas se for página 1, sem busca, sem cursor e ordenação padrão)
    if (page === 1 && !cursor && !search && sortBy === 'friendshipDate' && sortDirection === 'desc') {
      const cachedData = await getCached<any>(cacheKey);
      if (cachedData) {
        logger.info(`✅ [Cache] HIT: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }
    }

    let query = db.collection('friendships')
      .where('userId', '==', userId)
      .where('status', '==', 'accepted');

    // --- Lógica de Busca e Ordenação ---
    if (search) {
      // Busca Nativa por Prefixo (Escalável)
      if (search.startsWith('@')) {
        const term = search.substring(1);
        query = query
          .orderBy('friend.nickname')
          .orderBy('__name__') // Tie breaker
          .startAt(term)
          .endAt(term + '\uf8ff');
      } else {
        query = query
          .orderBy('friend.displayName')
          .orderBy('__name__') // Tie breaker
          .startAt(search)
          .endAt(search + '\uf8ff');
      }
    } else {
      // Ordenação padrão
      if (sortBy === 'name') {
        query = query.orderBy('friend.displayName', sortDirection);
      } else if (sortBy === 'nickname') {
        query = query.orderBy('friend.nickname', sortDirection);
      } else {
        query = query.orderBy('friendshipDate', sortDirection);
      }
      query = query.orderBy('__name__', sortDirection); // Tie breaker para cursor estável
    }

    // --- Contagem Total (Agregação Rápida) ---
    // Nota: count() não é afetado por limit/offset subsequentes na construção da query
    // mas se usarmos startAt/endAt (busca), ele conta apenas os filtrados. Perfeito.
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // --- Paginação ---
    query = query.limit(limit);

    if (cursor) {
      try {
        const startAfterValues = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));

        // Reidratar datas e Timestamps (precisão de nanosegundos)
        const hydratedValues = startAfterValues.map((val: any) => {
          // Timestamp do Firestore customizado
          if (val && typeof val === 'object' && val._type === 'ts') {
            return new admin.firestore.Timestamp(val.s, val.n);
          }
          // Regex simples para detectar ISO string de data (fallback)
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            return new Date(val);
          }
          return val;
        });

        query = query.startAfter(...hydratedValues);
      } catch (e) {
        logger.warn('Cursor inválido ignorado', { cursor });
      }
    } else if (page > 1) {
      // Fallback para offset se não houver cursor (menos performático)
      query = query.offset((page - 1) * limit);
    }

    const snapshot = await query.get();

    const friends = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // --- Gerar Próximo Cursor ---
    let nextCursor = null;
    if (snapshot.docs.length === limit) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const data = lastDoc.data();
      const values = [];

      if (search) {
        if (search.startsWith('@')) values.push(data.friend?.nickname);
        else values.push(data.friend?.displayName);
      } else {
        if (sortBy === 'name') values.push(data.friend?.displayName);
        else if (sortBy === 'nickname') values.push(data.friend?.nickname);
        else values.push(data.friendshipDate);
      }

      values.push(lastDoc.id); // __name__

      // Serializar valores para dates/timestamps se necessário
      const serializedValues = values.map(v => {
        // Preservar precisão do Timestamp (segundos + nanosegundos)
        if (v && typeof v.toMillis === 'function' && 'seconds' in v && 'nanoseconds' in v) {
          return { _type: 'ts', s: v.seconds, n: v.nanoseconds };
        }
        // Fallback para Date (se for Date nativo do JS)
        if (v instanceof Date) {
          return v.toISOString();
        }
        return v;
      });

      nextCursor = Buffer.from(JSON.stringify(serializedValues)).toString('base64');
    }

    const totalPages = Math.ceil(total / limit);

    // Convertendo datas para serialização JSON
    // (O Express faz isso, mas se tiver Timestamps crus, vira objeto estranho)
    const sanitizedFriends = friends.map((f: any) => ({
      ...f,
      friendshipDate: f.friendshipDate?.toDate?.() || f.friendshipDate,
      createdAt: f.createdAt?.toDate?.() || f.createdAt,
      updatedAt: f.updatedAt?.toDate?.() || f.updatedAt,
      lastActive: f.lastActive?.toDate?.() || f.lastActive,
    }));

    const response = {
      data: sanitizedFriends,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: !!nextCursor || (page < totalPages), // Hibrido
        nextCursor
      },
    };

    // Cache (se não houver busca)
    if (!search && !cursor && page === 1) {
      // Cache apenas da primeira página padrão
      const cacheKey = CacheKeys.friends(userId, 1);
      await setCache(cacheKey, response, 300);
    }

    logger.info(`Listagem de amigos (Escalável): ${userId}, ${sanitizedFriends.length}/${total} items`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error('Erro ao listar amigos:', error);
    return next(error);
  }
});

/**
 * GET /api/friendships/requests
 * Lista pedidos de amizade recebidos (pendentes)
 */
router.get('/friendships/requests', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = listRequestsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos', details: validationResult.error.flatten().fieldErrors });
    }

    const { page, limit, search, cursor } = validationResult.data;

    let query = db.collection('friendships')
      .where('userId', '==', userId)
      .where('status', '==', 'pending');
    // .where('requestedBy', '!=', userId); // REMOVIDO: Causa erro com orderBy('createdAt')

    // Busca (Somente displayName para simplificar e garantir índice)
    if (search) {
      query = query
        .orderBy('friend.displayName')
        .orderBy('__name__')
        .startAt(search)
        .endAt(search + '\uf8ff');
    } else {
      query = query
        .orderBy('createdAt', 'desc')
        .orderBy('__name__', 'desc');
    }

    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    query = query.limit(limit);

    if (cursor) {
      try {
        const values = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        query = query.startAfter(...values);
      } catch (e) { }
    } else if (page > 1) {
      query = query.offset((page - 1) * limit);
    }

    const snapshot = await query.get();

    // FILTRO EM MEMÓRIA: Apenas Recebidas
    const requests = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((doc: any) => doc.requestedBy !== userId);

    // Gerar Next Cursor
    let nextCursor = null;
    if (snapshot.docs.length === limit) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const data = lastDoc.data();
      const values = [];
      if (search) {
        values.push(data.friend?.displayName);
      } else {
        values.push(data.createdAt?.toDate?.().toISOString() || data.createdAt);
      }
      values.push(lastDoc.id);
      nextCursor = Buffer.from(JSON.stringify(values)).toString('base64');
    }

    const totalPages = Math.ceil(total / limit);
    const sanitizedRequests = requests.map((f: any) => ({
      ...f,
      createdAt: f.createdAt?.toDate?.() || f.createdAt,
      updatedAt: f.updatedAt?.toDate?.() || f.updatedAt,
    }));

    return res.status(200).json({
      data: sanitizedRequests,
      pagination: { page, limit, total, totalPages, hasMore: !!nextCursor || (page < totalPages), nextCursor },
    });
  } catch (error) {
    logger.error('Erro ao listar pedidos recebidos:', error);
    return next(error);
  }
});

/**
 * GET /api/friendships/sent
 * Lista pedidos de amizade enviados (pendentes)
 */
router.get('/friendships/sent', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = listRequestsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos', details: validationResult.error.flatten().fieldErrors });
    }

    const { page, limit, search, cursor } = validationResult.data;

    let query = db.collection('friendships')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .where('requestedBy', '==', userId); // Apenas Enviadas

    if (search) {
      query = query
        .orderBy('friend.displayName')
        .orderBy('__name__')
        .startAt(search)
        .endAt(search + '\uf8ff');
    } else {
      query = query
        .orderBy('createdAt', 'desc')
        .orderBy('__name__', 'desc');
    }

    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    query = query.limit(limit);

    if (cursor) {
      try {
        const values = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        query = query.startAfter(...values);
      } catch (e) { }
    } else if (page > 1) {
      query = query.offset((page - 1) * limit);
    }

    const snapshot = await query.get();
    const sent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let nextCursor = null;
    if (snapshot.docs.length === limit) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const data = lastDoc.data();
      const values = [];
      if (search) {
        values.push(data.friend?.displayName);
      } else {
        values.push(data.createdAt?.toDate?.().toISOString() || data.createdAt);
      }
      values.push(lastDoc.id);
      nextCursor = Buffer.from(JSON.stringify(values)).toString('base64');
    }

    const totalPages = Math.ceil(total / limit);
    const sanitizedSent = sent.map((f: any) => ({
      ...f,
      createdAt: f.createdAt?.toDate?.() || f.createdAt,
      updatedAt: f.updatedAt?.toDate?.() || f.updatedAt,
    }));

    return res.status(200).json({
      data: sanitizedSent,
      pagination: { page, limit, total, totalPages, hasMore: !!nextCursor || (page < totalPages), nextCursor },
    });
  } catch (error) {
    logger.error('Erro ao listar pedidos enviados:', error);
    return next(error);
  }
});

// ==================== OPERAÇÕES DE AMIZADE ====================

/**
 * POST /api/friendships/request
 * Envia solicitação de amizade
 */
router.post('/friendships/request', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const fromUserId = authReq.user.uid;

    const validationResult = sendFriendRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn('Falha na validação de solicitação de amizade', {
        userId: fromUserId,
        errors: validationResult.error.flatten().fieldErrors,
      });
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { targetUserId } = validationResult.data;

    // Validações de segurança
    if (fromUserId === targetUserId) {
      return res.status(400).json({ error: 'Você não pode enviar solicitação para si mesmo' });
    }

    // Verificar bloqueio
    await ensureNotBlocked(fromUserId, targetUserId);

    const fromUserFriendshipRef = db.collection('friendships').doc(`${fromUserId}_${targetUserId}`);
    const toUserFriendshipRef = db.collection('friendships').doc(`${targetUserId}_${fromUserId}`);

    // Calcular amigos em comum ANTES da transação (não pode fazer queries dentro)
    const mutualFriends = await calculateMutualFriends(fromUserId, targetUserId);

    await db.runTransaction(async (transaction) => {
      // Leitura sequencial para evitar erros INTERNAL no emulador
      const fromDoc = await transaction.get(fromUserFriendshipRef);

      if (fromDoc.exists) {
        throw new Error('Relação de amizade já existe');
      }

      // Buscar dados dos usuários sequencialmente
      const fromUserDoc = await transaction.get(db.collection('users').doc(fromUserId));
      const toUserDoc = await transaction.get(db.collection('users').doc(targetUserId));

      if (!fromUserDoc.exists || !toUserDoc.exists) {
        throw new Error('Usuário não encontrado');
      }

      const fromUserData = fromUserDoc.data();
      const toUserData = toUserDoc.data();

      const timestamp = admin.firestore.Timestamp.now();

      // Criar documentos de amizade bidirecionais
      transaction.set(fromUserFriendshipRef, {
        userId: fromUserId,
        friendId: targetUserId,
        status: 'pending',
        requestedBy: fromUserId,
        createdAt: timestamp,
        updatedAt: timestamp,
        friend: {
          displayName: toUserData?.displayName || '',
          nickname: toUserData?.nickname || '',
          photoURL: toUserData?.photoURL || null,
          email: toUserData?.email || '',
          bio: toUserData?.bio || '',
          location: toUserData?.location || '',
          joinedAt: toUserData?.joinedAt || timestamp,
          lastActive: toUserData?.lastActive || null,
        },
        mutualFriendsCount: mutualFriends.count,
        mutualFriendsPreview: mutualFriends.preview,
      });

      transaction.set(toUserFriendshipRef, {
        userId: targetUserId,
        friendId: fromUserId,
        status: 'pending',
        requestedBy: fromUserId,
        createdAt: timestamp,
        updatedAt: timestamp,
        friend: {
          displayName: fromUserData?.displayName || '',
          nickname: fromUserData?.nickname || '',
          photoURL: fromUserData?.photoURL || null,
          email: fromUserData?.email || '',
          bio: fromUserData?.bio || '',
          location: fromUserData?.location || '',
          joinedAt: fromUserData?.joinedAt || timestamp,
          lastActive: fromUserData?.lastActive || null,
        },
        mutualFriendsCount: mutualFriends.count,
        mutualFriendsPreview: mutualFriends.preview,
      });


    });

    logger.info(`Solicitação de amizade enviada: ${fromUserId} → ${targetUserId}`);

    // Invalidar cache de AMBOS
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(fromUserId)),
      invalidatePattern(CacheKeys.allUserPattern(targetUserId))
    ]);

    return res.status(201).json({ message: 'Solicitação enviada com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao enviar solicitação de amizade:', error);
    if (error.message === 'Relação de amizade já existe') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Ação não permitida devido a bloqueio.') {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  }
});

/**
 * POST /api/friendships/:friendshipId/accept
 * Aceita solicitação de amizade
 */
router.post('/friendships/:friendshipId/accept', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = friendshipIdParamSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { friendshipId } = validationResult.data;

    // friendshipId pode estar em qualquer ordem: userId_friendId ou friendId_userId
    const [id1, id2] = friendshipId.split('_');

    // Verificar se o usuário atual está envolvido na relação
    if (id1 !== userId && id2 !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para aceitar esta solicitação' });
    }

    // Determinar quem é o amigo (o outro ID que não é o usuário atual)
    const friendId = id1 === userId ? id2 : id1;

    // Verificar bloqueio
    await ensureNotBlocked(userId, friendId);

    // Tentar ambas as ordens possíveis dos documentos
    const userFriendshipRef = db.collection('friendships').doc(`${userId}_${friendId}`);
    const friendFriendshipRef = db.collection('friendships').doc(`${friendId}_${userId}`);

    await db.runTransaction(async (transaction) => {
      // TODAS as leituras PRIMEIRO (regra do Firestore)
      const userDoc = await transaction.get(userFriendshipRef);
      const friendDoc = await transaction.get(friendFriendshipRef);

      // Validações após todas as leituras
      if (!userDoc.exists || !friendDoc.exists) {
        throw new Error('Solicitação de amizade não encontrada');
      }

      const userData = userDoc.data();
      if (userData?.status !== 'pending') {
        throw new Error('Solicitação não está pendente');
      }

      if (userData?.requestedBy === userId) {
        throw new Error('Você não pode aceitar sua própria solicitação');
      }

      const timestamp = admin.firestore.Timestamp.now();

      // TODAS as escritas DEPOIS
      transaction.update(userFriendshipRef, {
        status: 'accepted',
        friendshipDate: timestamp,
        updatedAt: timestamp,
      });

      transaction.update(friendFriendshipRef, {
        status: 'accepted',
        friendshipDate: timestamp,
        updatedAt: timestamp,
      });


    });



    // Atualizar mutualFriendsCount para amizades afetadas (wait for completion)
    try {
      await updateMutualFriendsForNewFriendship(userId, friendId);
    } catch (err) {
      logger.error('Erro ao atualizar amigos em comum após aceitar amizade:', err);
      // Continue anyway - the friendship is already accepted
    }

    logger.info(`Amizade aceita: ${userId} ↔ ${friendId}`);

    // Invalidar cache de AMBOS
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(friendId))
    ]);

    return res.status(200).json({ message: 'Solicitação aceita com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao aceitar solicitação:', error);
    if (error.message.includes('não encontrada') || error.message.includes('pendente') || error.message.includes('própria')) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

/**
 * DELETE /api/friendships/:friendshipId
 * Rejeita/cancela solicitação ou remove amizade
 */
router.delete('/friendships/:friendshipId', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = friendshipIdParamSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { friendshipId } = validationResult.data;
    logger.info(`[DELETE] friendshipId recebido: ${friendshipId}, userId: ${userId}`);

    const [id1, id2] = friendshipId.split('_');
    logger.info(`[DELETE] id1: ${id1}, id2: ${id2}`);

    // Verificar se o usuário atual está envolvido na relação
    if (id1 !== userId && id2 !== userId) {
      logger.warn(`[DELETE] Usuário ${userId} não tem permissão para modificar ${friendshipId}`);
      return res.status(403).json({ error: 'Você não tem permissão para modificar esta relação' });
    }

    // Determinar quem é o amigo (o outro ID que não é o usuário atual)
    const friendId = id1 === userId ? id2 : id1;
    logger.info(`[DELETE] friendId determinado: ${friendId}`);

    // Sempre construir os dois IDs na ordem correta
    const doc1Id = `${userId}_${friendId}`;
    const doc2Id = `${friendId}_${userId}`;
    logger.info(`[DELETE] doc1Id: ${doc1Id}, doc2Id: ${doc2Id}`);

    const friendshipRef1 = db.collection('friendships').doc(doc1Id);
    const friendshipRef2 = db.collection('friendships').doc(doc2Id);

    // Implementação via Batch (mais robusta contra erros internos do emulador)
    const batch = db.batch();

    // 1. Ler documentos antes (fora de transação)
    logger.info(`[DELETE] Lendo documentos...`);
    const doc1 = await friendshipRef1.get();
    const doc2 = await friendshipRef2.get();

    logger.info(`[DELETE] doc1.exists: ${doc1.exists}, doc2.exists: ${doc2.exists}`);

    if (!doc1.exists && !doc2.exists) {
      logger.error(`[DELETE] Nenhum documento encontrado`);
      throw new Error('Relação de amizade não encontrada');
    }

    // Pegar os dados do documento que existe
    const data = doc1.exists ? doc1.data() : doc2.data();
    const requestedBy = data?.requestedBy;
    const status = data?.status;

    logger.info(`[DELETE] requestedBy: ${requestedBy}, status: ${status}`);

    // Deletar documentos de amizade
    logger.info(`[DELETE] Deletando documentos`);
    if (doc1.exists) batch.delete(friendshipRef1);
    if (doc2.exists) batch.delete(friendshipRef2);

    // (Counter updates removed - handled by Cloud Functions)

    logger.info(`[DELETE] Commitando batch...`);
    await batch.commit();
    logger.info(`[DELETE] Batch concluído com sucesso`);

    // Se era uma amizade aceita, atualizar mutualFriendsCount das amizades afetadas (em background)
    if (status === 'accepted') {
      updateMutualFriendsForRemovedFriendship(userId, friendId).catch(err => {
        logger.error('Erro ao atualizar amigos em comum após remover amizade:', err);
      });
    }

    logger.info(`Relação de amizade removida: ${userId} - ${friendId}`);

    // Invalidar cache de AMBOS
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(friendId))
    ]);

    return res.status(200).json({ message: 'Relação removida com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao remover relação:', error);
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    return next(error);
  }
});

// ==================== AÇÕES EM LOTE ====================

/**
 * POST /api/friendships/bulk-accept
 * Aceita múltiplas solicitações de amizade em uma transação
 */
router.post('/friendships/bulk-accept', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = bulkFriendshipSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { friendIds } = validationResult.data;
    const results: { accepted: string[]; skipped: Array<{ friendId: string; reason: string }> } = {
      accepted: [],
      skipped: [],
    };

    await db.runTransaction(async (transaction) => {
      // 1. Ler todos os documentos de amizade
      const reads = await Promise.all(
        friendIds.map(async (friendId) => {
          const userDocRef = db.collection('friendships').doc(`${userId}_${friendId}`);
          const friendDocRef = db.collection('friendships').doc(`${friendId}_${userId}`);
          const [userDoc, friendDoc] = await Promise.all([
            transaction.get(userDocRef),
            transaction.get(friendDocRef),
          ]);
          return { friendId, userDocRef, friendDocRef, userDoc, friendDoc };
        })
      );

      // 2. Validar e separar válidos de inválidos
      const valid: typeof reads = [];
      for (const item of reads) {
        if (!item.userDoc.exists || !item.friendDoc.exists) {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não encontrada' });
          continue;
        }
        const data = item.userDoc.data();
        if (data?.status !== 'pending') {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não está pendente' });
          continue;
        }
        if (data?.requestedBy === userId) {
          results.skipped.push({ friendId: item.friendId, reason: 'Não pode aceitar própria solicitação' });
          continue;
        }
        valid.push(item);
      }

      if (valid.length === 0) return;

      const timestamp = admin.firestore.Timestamp.now();

      // 3. Aplicar escritas para todos os válidos
      for (const item of valid) {
        transaction.update(item.userDocRef, {
          status: 'accepted',
          friendshipDate: timestamp,
          updatedAt: timestamp,
        });
        transaction.update(item.friendDocRef, {
          status: 'accepted',
          friendshipDate: timestamp,
          updatedAt: timestamp,
        });

        results.accepted.push(item.friendId);
      }

      // (Counter updates removed - handled by Cloud Functions)
    });



    logger.info(`Bulk accept: ${userId} aceitou ${results.accepted.length}/${friendIds.length} solicitações`);

    // Invalidar cache do usuário atual e de todos os amigos aceitos
    const invalidations = [invalidatePattern(CacheKeys.allUserPattern(userId))];
    results.accepted.forEach(fId => invalidations.push(invalidatePattern(CacheKeys.allUserPattern(fId))));
    await Promise.all(invalidations);

    return res.status(200).json({
      message: `${results.accepted.length} solicitações aceitas`,
      ...results,
    });
  } catch (error) {
    logger.error('Erro ao aceitar solicitações em lote:', error);
    return next(error);
  }
});

/**
 * POST /api/friendships/bulk-reject
 * Rejeita múltiplas solicitações de amizade recebidas em uma transação
 */
router.post('/friendships/bulk-reject', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = bulkFriendshipSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { friendIds } = validationResult.data;
    const results: { rejected: string[]; skipped: Array<{ friendId: string; reason: string }> } = {
      rejected: [],
      skipped: [],
    };

    await db.runTransaction(async (transaction) => {
      const reads = await Promise.all(
        friendIds.map(async (friendId) => {
          const userDocRef = db.collection('friendships').doc(`${userId}_${friendId}`);
          const friendDocRef = db.collection('friendships').doc(`${friendId}_${userId}`);
          const userDoc = await transaction.get(userDocRef);
          return { friendId, userDocRef, friendDocRef, userDoc };
        })
      );

      const valid: typeof reads = [];
      for (const item of reads) {
        if (!item.userDoc.exists) {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não encontrada' });
          continue;
        }
        const data = item.userDoc.data();
        if (data?.status !== 'pending') {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não está pendente' });
          continue;
        }
        if (data?.requestedBy === userId) {
          results.skipped.push({ friendId: item.friendId, reason: 'Use bulk-cancel para solicitações enviadas' });
          continue;
        }
        valid.push(item);
      }

      if (valid.length === 0) return;



      for (const item of valid) {
        transaction.delete(item.userDocRef);
        transaction.delete(item.friendDocRef);
        results.rejected.push(item.friendId);
      }
    });

    logger.info(`Bulk reject: ${userId} rejeitou ${results.rejected.length}/${friendIds.length} solicitações`);

    // Invalidar cache do usuário atual e de todos os amigos rejeitados
    const invalidations = [invalidatePattern(CacheKeys.allUserPattern(userId))];
    results.rejected.forEach(fId => invalidations.push(invalidatePattern(CacheKeys.allUserPattern(fId))));
    await Promise.all(invalidations);

    return res.status(200).json({
      message: `${results.rejected.length} solicitações rejeitadas`,
      ...results,
    });
  } catch (error) {
    logger.error('Erro ao rejeitar solicitações em lote:', error);
    return next(error);
  }
});

/**
 * POST /api/friendships/bulk-cancel
 * Cancela múltiplas solicitações de amizade enviadas em uma transação
 */
router.post('/friendships/bulk-cancel', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = bulkFriendshipSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { friendIds } = validationResult.data;
    const results: { cancelled: string[]; skipped: Array<{ friendId: string; reason: string }> } = {
      cancelled: [],
      skipped: [],
    };

    await db.runTransaction(async (transaction) => {
      const reads = await Promise.all(
        friendIds.map(async (friendId) => {
          const userDocRef = db.collection('friendships').doc(`${userId}_${friendId}`);
          const friendDocRef = db.collection('friendships').doc(`${friendId}_${userId}`);
          const userDoc = await transaction.get(userDocRef);
          return { friendId, userDocRef, friendDocRef, userDoc };
        })
      );

      const valid: typeof reads = [];
      for (const item of reads) {
        if (!item.userDoc.exists) {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não encontrada' });
          continue;
        }
        const data = item.userDoc.data();
        if (data?.status !== 'pending') {
          results.skipped.push({ friendId: item.friendId, reason: 'Solicitação não está pendente' });
          continue;
        }
        if (data?.requestedBy !== userId) {
          results.skipped.push({ friendId: item.friendId, reason: 'Use bulk-reject para solicitações recebidas' });
          continue;
        }
        valid.push(item);
      }

      if (valid.length === 0) return;

      for (const item of valid) {
        transaction.delete(item.userDocRef);
        transaction.delete(item.friendDocRef);
        results.cancelled.push(item.friendId);
      }
    });
    logger.info(`Bulk cancel: ${userId} cancelou ${results.cancelled.length}/${friendIds.length} solicitações`);

    // Invalidar cache do usuário atual e de todos os amigos cancelados
    const invalidations = [invalidatePattern(CacheKeys.allUserPattern(userId))];
    results.cancelled.forEach(fId => invalidations.push(invalidatePattern(CacheKeys.allUserPattern(fId))));
    await Promise.all(invalidations);

    return res.status(200).json({
      message: `${results.cancelled.length} solicitações canceladas`,
      ...results,
    });
  } catch (error) {
    logger.error('Erro ao cancelar solicitações em lote:', error);
    return next(error);
  }
});

// ==================== SINCRONIZAÇÃO ====================

const FIRESTORE_BATCH_LIMIT = 500;

/**
 * POST /api/friendships/sync-profile
 * Atualiza dados denormalizados do usuário em todas as suas amizades
 * Deve ser chamado após edição de perfil ou foto
 */
router.post('/friendships/sync-profile', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    // 1. Buscar dados atuais do usuário
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data()!;

    // 2. Buscar todas as amizades onde este usuário aparece como "friend"
    const snapshot = await db.collection('friendships')
      .where('friendId', '==', userId)
      .get();

    if (snapshot.empty) {
      logger.info(`Sync-profile: nenhuma amizade para atualizar (${userId})`);
      return res.status(200).json({ message: 'Nenhum documento para atualizar', updated: 0 });
    }

    // 3. Atualizar em lotes (Firestore limita a 500 operações por batch)
    const docs = snapshot.docs;
    let updated = 0;

    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);

      for (const docSnapshot of chunk) {
        batch.update(docSnapshot.ref, {
          'friend.displayName': userData.displayName || '',
          'friend.nickname': userData.nickname || '',
          'friend.photoURL': userData.photoURL || null,
          'friend.bio': userData.bio || '',
          'friend.location': userData.location || '',
          updatedAt: admin.firestore.Timestamp.now(),
        });
        updated++;
      }

      await batch.commit();
    }

    logger.info(`Sync-profile: ${updated} documentos atualizados para ${userId}`);
    return res.status(200).json({
      message: `${updated} documentos atualizados`,
      updated,
    });
  } catch (error) {
    logger.error('Erro ao sincronizar perfil denormalizado:', error);
    return next(error);
  }
});

/**
 * GET /api/friendships/mutual/:userId
 * Calcula amigos em comum entre usuário logado e outro usuário
 */
router.get('/friendships/mutual/:userId', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.user.uid;

    const validationResult = friendshipStatusParamSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { userId: targetUserId } = validationResult.data;

    if (currentUserId === targetUserId) {
      return res.status(200).json({ count: 0, friends: [] });
    }

    // Verificar se o usuário alvo bloqueou o usuário atual
    const isBlocked = await isBlockedBy(targetUserId, currentUserId);
    if (isBlocked) {
      logger.info(`Acesso a amigos mútuos bloqueado: ${targetUserId} bloqueou ${currentUserId}`);
      return res.status(403).json({
        error: 'Não é possível visualizar amigos mútuos com este usuário'
      });
    }

    // Buscar amigos de ambos os usuários em paralelo
    const [currentUserFriendsSnapshot, targetUserFriendsSnapshot] = await Promise.all([
      db.collection('friendships')
        .where('userId', '==', currentUserId)
        .where('status', '==', 'accepted')
        .get(),
      db.collection('friendships')
        .where('userId', '==', targetUserId)
        .where('status', '==', 'accepted')
        .get(),
    ]);

    // Criar set com IDs dos amigos do usuário atual
    const currentUserFriendIds = new Set<string>();
    currentUserFriendsSnapshot.docs.forEach(doc => {
      currentUserFriendIds.add(doc.data().friendId);
    });

    // Encontrar interseção e coletar dados dos amigos mútuos
    const mutualFriends: Array<{
      id: string;
      displayName: string;
      nickname: string;
      photoURL: string | null;
    }> = [];

    targetUserFriendsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const friendId = data.friendId;

      if (currentUserFriendIds.has(friendId)) {
        const friendData = data.friend || {};
        mutualFriends.push({
          id: friendId,
          displayName: friendData.displayName || 'Usuário',
          nickname: friendData.nickname || '',
          photoURL: friendData.photoURL || null,
        });
      }
    });

    logger.info(`Amigos mútuos calculados: ${currentUserId} & ${targetUserId} = ${mutualFriends.length}`);
    return res.status(200).json({
      count: mutualFriends.length,
      friends: mutualFriends,
    });
  } catch (error) {
    logger.error('Erro ao calcular amigos mútuos:', error);
    return next(error);
  }
});

/**
 * GET /api/friendships/status/:userId
 * Verifica status de amizade com um usuário
 */
router.get('/friendships/status/:userId', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.user.uid;

    const validationResult = friendshipStatusParamSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { userId: targetUserId } = validationResult.data;

    if (currentUserId === targetUserId) {
      return res.status(200).json({ status: 'self' });
    }

    // Verificar se há bloqueio em qualquer direção
    const isBlocked = await isBlockedBy(targetUserId, currentUserId);
    if (isBlocked) {
      logger.info(`Acesso ao status de amizade bloqueado: ${targetUserId} bloqueou ${currentUserId}`);
      return res.status(403).json({
        error: 'Não é possível visualizar o status com este usuário'
      });
    }

    const friendshipDoc = await db
      .collection('friendships')
      .doc(`${currentUserId}_${targetUserId}`)
      .get();

    if (!friendshipDoc.exists) {
      return res.status(200).json({ status: 'none' });
    }

    const data = friendshipDoc.data();
    const status = data?.status;
    const requestedBy = data?.requestedBy;

    if (status === 'accepted') {
      return res.status(200).json({ status: 'friends' });
    }

    if (status === 'pending') {
      if (requestedBy === currentUserId) {
        return res.status(200).json({ status: 'request_sent' });
      } else {
        return res.status(200).json({ status: 'request_received' });
      }
    }

    return res.status(200).json({ status: 'none' });
  } catch (error) {
    logger.error('Erro ao verificar status de amizade:', error);
    return next(error);
  }
});

// ==================== BLOQUEIO ====================

/**
 * POST /api/friendships/block
 * Bloqueia um usuário
 */
router.post('/friendships/block', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = blockUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { targetUserId } = validationResult.data;

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Você não pode bloquear a si mesmo' });
    }

    const blockId = `${userId}_${targetUserId}`;
    const blockRef = db.collection('blocks').doc(blockId);

    await blockRef.set({
      blockerId: userId,
      blockedId: targetUserId,
      createdAt: admin.firestore.Timestamp.now(),
    });

    logger.info(`Usuário bloqueado: ${userId} -> ${targetUserId}`);

    // Nota: O trigger onBlockCreated cuidará de remover amizades existentes

    // Invalidar cache de ambos os usuários
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(targetUserId))
    ]);

    return res.status(200).json({ message: 'Usuário bloqueado com sucesso', blockId });
  } catch (error) {
    logger.error('Erro ao bloquear usuário:', error);
    return next(error);
  }
});

/**
 * POST /api/friendships/unblock
 * Desbloqueia um usuário
 */
router.post('/friendships/unblock', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = unblockUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { targetUserId } = validationResult.data;
    const blockId = `${userId}_${targetUserId}`;

    await db.collection('blocks').doc(blockId).delete();

    logger.info(`Usuário desbloqueado: ${userId} -> ${targetUserId}`);

    // Invalidar cache de ambos os usuários
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(targetUserId))
    ]);

    return res.status(200).json({ message: 'Usuário desbloqueado com sucesso' });
  } catch (error) {
    logger.error('Erro ao desbloquear usuário:', error);
    return next(error);
  }
});

/**
 * GET /api/friendships/blocking/list
 * Lista usuários bloqueados pelo usuário atual
 */
router.get('/friendships/blocking/list', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    // Buscar bloqueios onde blockerId == userId
    const blocksSnapshot = await db.collection('blocks')
      .where('blockerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    if (blocksSnapshot.empty) {
      return res.json({ data: [] });
    }

    const blockedIds = blocksSnapshot.docs.map(doc => doc.data().blockedId);

    // Buscar detalhes dos usuários bloqueados (limite de 10 por batch se fosse batchGet, mas aqui getAll aceita array)
    // Firestore getAll suporta ~100 docs? Verificar. Para listas pequenas ok.
    // Se for muito grande, ideal seria paginar ou armazenar dados denormalizados no block.
    // Assumindo lista < 100 por enquanto.

    const blockedUsersRefs = blockedIds.map(id => db.collection('users').doc(id));
    if (blockedUsersRefs.length === 0) {
      return res.json({ data: [] });
    }

    // Usar Promise.all com get() individual para maior compatibilidade/robez
    const usersSnapshot = await Promise.all(blockedUsersRefs.map(ref => ref.get()));

    const blockedUsers = usersSnapshot
      .filter(doc => doc.exists)
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data?.displayName || 'Usuário',
          nickname: data?.nickname || '',
          photoURL: data?.photoURL || null,
        };
      });

    return res.json({ data: blockedUsers });
  } catch (error) {
    logger.error('Erro ao listar usuários bloqueados:', error);
    return next(error);
  }
});

export default router;
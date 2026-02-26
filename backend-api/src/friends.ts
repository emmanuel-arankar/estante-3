// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { admin, db } from './firebase';
import {
  checkAuth,
  AuthenticatedRequest
} from './middleware/auth.middleware';
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
import { AuditService } from './services/audit.service';

const router = Router();

// =============================================================================
// CONFIGURAÇÕES E CONSTANTES
// =============================================================================

/**
 * @name Limite de Busca
 * @summary Quantidade máxima de resultados para pesquisa de amigos.
 * @description Define o limite de documentos retornados em operações de busca para controlar 
 * o consumo de recursos e latência.
 */
const FIND_FRIENDS_LIMIT = parseInt(process.env.FIND_FRIENDS_QUERY_LIMIT || '', 10) || 10;
logger.info(`Usando limite de busca de amigos: ${FIND_FRIENDS_LIMIT}`);

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

/**
 * @name Calcular Amigos em Comum
 * @summary Calcula a interseção de amigos entre dois usuários.
 * @description Calcula a interseção de amigos aceitos entre dois usuários.
 * Retorna a contagem total e os IDs dos primeiros 3 amigos para visualização.
 * 
 * @params {string} userId1 - ID do primeiro usuário
 * @params {string} userId2 - ID do segundo usuário
 * @returns {Promise<{ count: number; preview: string[] }>} Contagem e array de IDs
 * 
 * @example
 * const { count, preview } = await calculateMutualFriends("userA", "userB");
 * 
 * @note Considerações de Performance:
 * - A função utiliza `Promise.all` para buscar os snapshots de ambos os usuários em paralelo.
 * - Utiliza `.select('friendId')` para reduzir o payload de rede e processamento do Firestore.
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
 * @name Atualizar Mútuos para Nova Amizade
 * @summary Incrementa contadores de mútuos após nova conexão.
 * @description Atualiza o contador `mutualFriendsCount` para todas as amizades 
 * afetadas quando uma nova conexão é estabelecida entre userId1 e userId2.
 * 
 * @params {string} userId1 - ID do primeiro usuário
 * @params {string} userId2 - ID do segundo usuário
 * @returns {Promise<void>}
 * 
 * @example
 * await updateMutualFriendsForNewFriendship("uid1", "uid2");
 * 
 * @note Lógica de Propagação:
 * - Esta função propaga o incremento de amigos mútuos para toda a rede afetada.
 * - Utiliza `db.batch()` para garantir que as atualizações sejam enviadas em um único lote atômico.
 * - Crítico para manter a consistência visual dos contadores de mútuos na interface.
 */
const updateMutualFriendsForNewFriendship = async (
  userId1: string,
  userId2: string
): Promise<void> => {
  // 1. Snapshot paralelo de amizades aceitas
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

  // Identificação da interseção
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
 * @name Atualizar Mútuos para Amizade Removida
 * @summary Decrementa contadores de mútuos após remoção de conexão.
 * @description Decrementa o contador `mutualFriendsCount` para todas as amizades
 * afetadas quando uma conexão é desfeita entre userId1 e userId2.
 * 
 * @params {string} userId1 - ID do primeiro usuário
 * @params {string} userId2 - ID do segundo usuário
 * @returns {Promise<void>}
 * 
 * @example
 * await updateMutualFriendsForRemovedFriendship("uid1", "uid2");
 * 
 * @note Lógica de Limpeza:
 * - Realiza o decremento atômico de amigos mútuos quando uma amizade é desfeita.
 * - Opera de forma similar à propagação, mas em sentido inverso, garantindo integridade dos dados históricos.
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

// =============================================================================
// ROTAS DE AMIZADE E GERENCIAMENTO
// =============================================================================

/**
 * @name Buscar Amigos
 * @summary Pesquisa perfis por nome ou handle.
 * @description Realiza a busca de perfis de usuários por nome de exibição ou @nickname,
 * utilizando queries paralelas para otimização e mesclagem de resultados.
 * 
 * @route {GET} /api/findFriends
 * @queryparam {string} searchTerm - Termo de busca (nome ou @nickname)
 * @returns {Array<Object>} 200 - Lista de usuários encontrados
 * 
 * @example
 * GET /api/findFriends?searchTerm=@joaosilva
 * 
 * @note Estratégia de Busca:
 * - Utiliza busca nativa de prefixo do Firestore (`>=` e `<= \uf8ff`).
 * - Executa queries paralelas para permitir busca simultânea por Nome e Nickname.
 * - Filtra automaticamente o usuário logado dos resultados para evitar solicitações a si mesmo.
 */
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

// =============================================================================
// LISTAGEM DE AMIZADES
// =============================================================================

/**
 * @name Listar Amizades
 * @summary Retorna lista de amigos aceitos com paginação.
 * @description Lista amigos aceitos com suporte a paginação baseada em cursor,
 * busca por texto e ordenação customizável. Utiliza cache para a primeira página.
 * 
 * @route {GET} /api/friendships
 * @queryparam {number} [page=1] - Número da página
 * @queryparam {number} [limit=10] - Limite de itens por página
 * @queryparam {string} [search] - Termo de busca por nome ou @nickname
 * @queryparam {string} [sortBy='friendshipDate'] - Campo para ordenação
 * @queryparam {string} [sortDirection='desc'] - Direção da ordenação (asc/desc)
 * @queryparam {string} [cursor] - Cursor para paginação baseada em cursor
 * @returns {Object} 200 - Objeto com amigos e paginação
 * 
 * @example
 * GET /api/friendships?page=1&limit=20&search=João
 * 
 * @note Performance e Cache:
 * - Implementa cache em Redis/Memória para a primeira página de resultados padrão.
 * - Utiliza paginação por cursor de alta precisão (nanosegundos do Firestore) para evitar saltos ou repetições.
 * - Inclui lógica de fallback para busca com capitalização automática (ex: "emma" -> "Emma").
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

    // Filtros de busca e regras de ordenação
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
      query = query.orderBy('__name__', sortDirection); // Critério de desempate para cursor estável
    }

    // Contagem de agregação paralela (otimizada pelo Firestore)
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // Configuração de paginação
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

    let snapshot = await query.get();

    // FALLBACK DE BUSCA: Se busca por nome não retornou nada, tentar Capitalized (ex: "emma" -> "Emma")
    if (snapshot.empty && search && !search.startsWith('@') && /^[a-z]/.test(search)) {
      const capitalizedSearch = search.charAt(0).toUpperCase() + search.slice(1);

      // Recriar a query com o termo capitalizado
      // Nota: precisamos reconstruir a query base para não afetar a anterior
      let fallbackQuery = db.collection('friendships')
        .where('userId', '==', userId)
        .where('status', '==', 'accepted');

      fallbackQuery = fallbackQuery
        .orderBy('friend.displayName')
        .orderBy('__name__')
        .startAt(capitalizedSearch)
        .endAt(capitalizedSearch + '\uf8ff');

      // Reaplicar paginação se necessário (limit apenas, cursor seria invalido se trocarmos a query base)
      fallbackQuery = fallbackQuery.limit(limit);

      const fallbackSnapshot = await fallbackQuery.get();
      if (!fallbackSnapshot.empty) {
        snapshot = fallbackSnapshot;
      }
    }

    const friends = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Geração de cursor para próxima página (serialização segura)
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

      values.push(lastDoc.id); // Critério de desempate (__name__)

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
 * @name Listar Pedidos de Amizade
 * @summary Retorna solicitações pendentes recebidas.
 * @description Retorna as solicitações de amizade recebidas pelo usuário logado que 
 * ainda estão com status 'pending'. Suporta paginação e busca.
 * 
 * @route {GET} /api/friendships/requests
 * @queryparam {number} [page=1] - Número da página
 * @queryparam {number} [limit=10] - Limite de itens por página
 * @queryparam {string} [search] - Termo de busca por nome
 * @queryparam {string} [cursor] - Cursor para paginação
 * @returns {Object} 200 - Objeto com dados dos pedidos e informações de paginação
 * @example
 * GET /api/friendships/requests?limit=5
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

    let snapshot = await query.get();

    // FALLBACK DE BUSCA: Se busca por nome não retornou nada, tentar Capitalized
    if (snapshot.empty && search && !search.startsWith('@') && /^[a-z]/.test(search)) {
      const capitalizedSearch = search.charAt(0).toUpperCase() + search.slice(1);

      let fallbackQuery = db.collection('friendships')
        .where('userId', '==', userId)
        .where('status', '==', 'pending');

      fallbackQuery = fallbackQuery
        .orderBy('friend.displayName')
        .orderBy('__name__')
        .startAt(capitalizedSearch)
        .endAt(capitalizedSearch + '\uf8ff');

      fallbackQuery = fallbackQuery.limit(limit);

      const fallbackSnapshot = await fallbackQuery.get();
      if (!fallbackSnapshot.empty) {
        snapshot = fallbackSnapshot;
      }
    }

    // Filtro em memória para separar solicitações recebidas
    const requests = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((doc: any) => doc.requestedBy !== userId);

    // Geração de cursor de paginação
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
 * @name Listar Pedidos Enviados
 * @summary Retorna solicitações pendentes enviadas.
 * @description Retorna as solicitações de amizade enviadas pelo usuário logado que 
 * ainda estão pendentes. Útil para gerenciamento de convites ativos.
 * 
 * @route {GET} /api/friendships/sent
 * @queryparam {number} [page=1] - Número da página
 * @queryparam {number} [limit=10] - Limite de itens por página
 * @queryparam {string} [search] - Termo de busca por nome
 * @queryparam {string} [cursor] - Cursor para paginação
 * @returns {Object} 200 - Objeto com dados dos pedidos enviados e informações de paginação
 * @example
 * GET /api/friendships/sent?page=2
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

    let snapshot = await query.get();

    // FALLBACK DE BUSCA: Se busca por nome não retornou nada, tentar Capitalized
    if (snapshot.empty && search && !search.startsWith('@') && /^[a-z]/.test(search)) {
      const capitalizedSearch = search.charAt(0).toUpperCase() + search.slice(1);

      let fallbackQuery = db.collection('friendships')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .where('requestedBy', '==', userId);

      fallbackQuery = fallbackQuery
        .orderBy('friend.displayName')
        .orderBy('__name__')
        .startAt(capitalizedSearch)
        .endAt(capitalizedSearch + '\uf8ff');

      fallbackQuery = fallbackQuery.limit(limit);

      const fallbackSnapshot = await fallbackQuery.get();
      if (!fallbackSnapshot.empty) {
        snapshot = fallbackSnapshot;
      }
    }
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

// =============================================================================
// OPERAÇÕES DE AMIZADE
// =============================================================================

/**
 * @name Enviar Solicitação de Amizade
 * @summary Envia um novo pedido de amizade.
 * @description Cria um novo pedido de amizade bidirecional ('pending') e notifica 
 * o usuário alvo. Realiza verificações de bloqueio e duplicidade.
 * 
 * @route {POST} /api/friendships/request
 * @bodyparams {string} targetUserId - ID do usuário alvo da solicitação
 * @returns {Object} 201 - { message: 'Solicitação enviada com sucesso' }
 * 
 * @example
 * POST /api/friendships/request
 * { "targetUserId": "UID_CONTATO" }
 * 
 * @throws {400} Erro se o usuário tentar adicionar a si mesmo ou dados forem inválidos.
 * @throws {403} Erro se o remetente estiver bloqueado pelo destinatário.
 * @throws {409} Erro se uma relação já existir entre ambos.
 * 
 * @note Integridade e Notificações:
 * - Executa em uma transação atômica para criar ambos os documentos de amizade simultaneamente.
 * - Atualiza os contadores globais (`sentRequestsCount` e `pendingRequestsCount`) de forma segura.
 * - Dispara uma notificação Firestore após o sucesso da transação.
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

    // Cálculo de mútuos pré-transação para evitar deadlock
    const mutualFriends = await calculateMutualFriends(fromUserId, targetUserId);

    await db.runTransaction(async (transaction) => {
      // 1. Verificação de existência e leitura sequencial
      const fromDoc = await transaction.get(fromUserFriendshipRef);

      if (fromDoc.exists) {
        throw new Error('Relação de amizade já existe');
      }

      // 2. Busca de dados de perfil para denormalização
      const fromUserDoc = await transaction.get(db.collection('users').doc(fromUserId));
      const toUserDoc = await transaction.get(db.collection('users').doc(targetUserId));

      if (!fromUserDoc.exists || !toUserDoc.exists) {
        throw new Error('Usuário não encontrado');
      }

      const fromUserData = fromUserDoc.data();
      const toUserData = toUserDoc.data();

      const timestamp = admin.firestore.Timestamp.now();

      // 3. Persistência bidirecional da relação
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

      // Atualizar contadores (atômico dentro da transação)
      const fromUserRef = db.collection('users').doc(fromUserId);
      const toUserRef = db.collection('users').doc(targetUserId);

      transaction.update(fromUserRef, {
        sentRequestsCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
      });

      transaction.update(toUserRef, {
        pendingRequestsCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
      });
    });

    logger.info(`Solicitação de amizade enviada: ${fromUserId} → ${targetUserId}`);

    // Audit Log: Solicitação de amizade
    AuditService.logAuditEvent({
      userId: fromUserId,
      action: 'FRIEND_REQUEST_SENT',
      category: 'SOCIAL',
      resourceId: targetUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.toString(),
      requestId: (req as any).requestId
    });

    // Registro de notificação fora da transação de escrita (eventual consistency)
    try {
      const fromUserDoc = await db.collection('users').doc(fromUserId).get();
      const fromUserData = fromUserDoc.data();

      await db.collection('notifications').add({
        userId: targetUserId,
        type: 'friend_request',
        actorId: fromUserId,
        actorName: fromUserData?.displayName || 'Alguém',
        actorPhoto: fromUserData?.photoURL || null,
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
        metadata: {
          friendshipId: `${targetUserId}_${fromUserId}`,
        },
      });

      logger.info(`Notificação de friend_request criada para ${targetUserId}`);
    } catch (notifError) {
      logger.error('Erro ao criar notificação de friend request:', notifError);
      // Não falhar a request se notificação falhar
    }

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
 * @name Aceitar Amizade
 * @summary Aceita uma solicitação de amizade pendente.
 * @description Aceita uma solicitação de amizade pendente, atualiza o status para 'accepted',
 * incrementa contadores e notifica o remetente. Realizado em transação atômica.
 * 
 * @route {POST} /api/friendships/:friendshipId/accept
 * @params {string} friendshipId - ID da relação de amizade
 * @returns {Object} 200 - { message: 'Amizade aceita com sucesso' }
 * 
 * @example
 * POST /api/friendships/UID1_UID2/accept
 * 
 * @throws {400} Erro se a solicitação não estiver pendente ou for inválida.
 * @throws {403} Erro se o usuário atual não estiver envolvido ou houver bloqueio.
 * 
 * @note Fluxo Pós-Aceite:
 * - Atualiza o status para 'accepted' e define a data oficial da amizade em transação.
 * - Incrementa `friendsCount` e decrementa contadores de pendências.
 * - Inicia o cálculo assíncrono de amigos mútuos para toda a rede afetada.
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

    // Identificação dos interlocutores na relação
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
      // 1. Validação de estado e integridade
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

      // 2. Transição de estado para amizade confirmada
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

      // Atualizar contadores (atômico dentro da transação)
      const requesterRef = db.collection('users').doc(userData?.requestedBy);
      const accepterRef = db.collection('users').doc(userId);

      // Quem aceitou: -1 pendingRequestsCount, +1 friendsCount
      transaction.update(accepterRef, {
        pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
        friendsCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
      });

      // Quem enviou: -1 sentRequestsCount, +1 friendsCount
      transaction.update(requesterRef, {
        sentRequestsCount: admin.firestore.FieldValue.increment(-1),
        friendsCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
      });
    });

    // Propagação de amigos mútuos em segundo plano
    try {
      await updateMutualFriendsForNewFriendship(userId, friendId);
    } catch (err) {
      logger.error('Erro ao atualizar amigos em comum após aceitar amizade:', err);
      // Continue anyway - the friendship is already accepted
    }

    logger.info(`Amizade aceita: ${userId} ↔ ${friendId}`);

    // Notificação de aceitação (assíncrona)
    try {
      const acceptorDoc = await db.collection('users').doc(userId).get();
      const acceptorData = acceptorDoc.data();

      await db.collection('notifications').add({
        userId: friendId, // friendId é quem enviou a solicitação
        type: 'friend_accepted',
        actorId: userId, // userId é quem aceitou
        actorName: acceptorData?.displayName || 'Alguém',
        actorPhoto: acceptorData?.photoURL || null,
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
        metadata: {
          friendshipId: `${friendId}_${userId}`,
        },
      });

      logger.info(`Notificação de friend_accepted criada para ${friendId}`);
    } catch (notifError) {
      logger.error('Erro ao criar notificação de friend accepted:', notifError);
      // Não falhar a request se notificação falhar
    }

    // Invalidar cache de AMBOS
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(friendId))
    ]);

    // Audit Log: Solicitação aceita
    AuditService.logAuditEvent({
      userId,
      action: 'FRIEND_REQUEST_ACCEPTED',
      category: 'SOCIAL',
      resourceId: friendId,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.toString(),
      requestId: (req as any).requestId
    });

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
 * @name Remover Relação de Amizade
 * @summary Rejeita, cancela ou remove amizade.
 * @description Rejeita/cancela solicitação pendente ou remove uma amizade existente,
 * atualizando contadores e limpando caches.
 * 
 * @route {DELETE} /api/friendships/:friendshipId
 * @params {string} friendshipId - ID da relação de amizade (userId1_userId2)
 * @returns {Object} 200 - { message: 'Relação removida com sucesso' }
 * 
 * @example
 * DELETE /api/friendships/UID1_UID2
 * 
 * @throws {403} Erro se o usuário logado não for um dos participantes da relação.
 * @throws {404} Erro se a relação não for encontrada.
 * 
 * @note Resiliência:
 * - Utiliza `db.batch()` para garantir que a remoção bidirecional e o ajuste de contadores ocorram de forma completa ou falhem totalmente.
 * - Gerencia automaticamente os contadores de `friendsCount`, `sentRequestsCount` ou `pendingRequestsCount` com base no status prévio.
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

    // Processamento de remoção e decremento de contadores se houver amizade
    const batch = db.batch();
    let hadAcceptedFriendship = false;

    // ==== ==== 1. SNAPSHOT DA RELAÇÃO E CONTADORES ==== ====
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

    // ==== ==== 2. EXECUÇÃO DA DELEÇÃO FÍSICA ==== ====
    if (doc1.exists) batch.delete(friendshipRef1);
    if (doc2.exists) batch.delete(friendshipRef2);

    // ==== ==== 3. AJUSTE DE CONTADORES GLOBAIS ==== ====
    const userRef = db.collection('users').doc(userId);
    const friendRef = db.collection('users').doc(friendId);
    const batchTimestamp = admin.firestore.Timestamp.now();

    if (status === 'accepted') {
      hadAcceptedFriendship = true;
      // Remover amizade: -1 friendsCount para ambos
      batch.update(userRef, {
        friendsCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: batchTimestamp,
      });
      batch.update(friendRef, {
        friendsCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: batchTimestamp,
      });
    } else if (status === 'pending') {
      // Cancelar/rejeitar solicitação pendente
      if (requestedBy === userId) {
        // Usuário atual é quem ENVIOU → cancelando
        batch.update(userRef, {
          sentRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: batchTimestamp,
        });
        batch.update(friendRef, {
          pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: batchTimestamp,
        });
      } else {
        // Usuário atual RECEBEU → rejeitando
        batch.update(userRef, {
          pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: batchTimestamp,
        });
        batch.update(friendRef, {
          sentRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: batchTimestamp,
        });
      }
    }

    logger.info(`[DELETE] Commitando batch...`);
    await batch.commit();
    logger.info(`[DELETE] Batch concluído com sucesso`);

    // Atualização de amigos mútuos em segundo plano
    if (hadAcceptedFriendship) {
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

    // Audit Log: Amizade removida
    AuditService.logAuditEvent({
      userId,
      action: 'FRIEND_REMOVED',
      category: 'SOCIAL',
      resourceId: friendId,
      metadata: { previousStatus: status },
      ip: req.ip,
      userAgent: req.get('User-Agent')?.toString(),
      requestId: (req as any).requestId
    });

    return res.status(200).json({ message: 'Relação removida com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao remover relação:', error);
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({ error: error.message });
    }
    return next(error);
  }
});

// =============================================================================
// AÇÕES EM LOTE
// =============================================================================

/**
 * @name Aceitar Amizades em Lote
 * @summary Aceita múltiplas solicitações em uma transação.
 * @description Aceita múltiplas solicitações de amizade de uma única vez, 
 * garantindo integridade dos contadores de todos os usuários envolvidos.
 * 
 * @route {POST} /api/friendships/bulk-accept
 * @bodyparams {string[]} friendIds - Lista de IDs de usuários cujas solicitações serão aceitas
 * @returns {Object} 200 - Resumo das solicitações aceitas e puladas
 * 
 * @example
 * POST /api/friendships/bulk-accept
 * { "friendIds": ["UID1", "UID2", "UID3"] }
 * 
 * @throws {400} Erro se o corpo da requisição for inválido.
 * 
 * @note Atomicidade em Massa:
 * - Processa múltiplos aceites em uma única transação Firestore para garantir que todos os contadores sejam atualizados de forma consistente.
 * - Filtra automaticamente solicitações que não estão mais pendentes ou não pertencem ao usuário atual.
 * - Invalida o cache de todos os usuários envolvidos para garantir dados frescos em toda a plataforma.
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
      // ==== ==== 1. LEITURA DOS DOCUMENTOS DE AMIZADE ==== ====
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

      // ==== ==== 2. VALIDAÇÃO DE ESTADO E SEGURANÇA ==== ====
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

      // ==== ==== 3. PERSISTÊNCIA EM LOTE ==== ====
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

      // Atualizar contadores (atômico dentro da transação)
      const accepterRef = db.collection('users').doc(userId);

      // Quem aceitou: -N pendingRequestsCount, +N friendsCount
      transaction.update(accepterRef, {
        pendingRequestsCount: admin.firestore.FieldValue.increment(-valid.length),
        friendsCount: admin.firestore.FieldValue.increment(valid.length),
        updatedAt: timestamp,
      });

      // Cada remetente: -1 sentRequestsCount, +1 friendsCount
      for (const item of valid) {
        const requesterData = item.userDoc.data();
        const requesterRef = db.collection('users').doc(requesterData?.requestedBy || item.friendId);
        transaction.update(requesterRef, {
          sentRequestsCount: admin.firestore.FieldValue.increment(-1),
          friendsCount: admin.firestore.FieldValue.increment(1),
          updatedAt: timestamp,
        });
      }
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
 * @name Rejeitar Amizades em Lote
 * @summary Rejeita múltiplas solicitações recebidas.
 * @description Rejeita múltiplas solicitações de amizade recebidas em uma única transação
 * atômica, atualizando contadores de pendências.
 * 
 * @route {POST} /api/friendships/bulk-reject
 * @bodyparams {string[]} friendIds - Lista de IDs de usuários cujas solicitações serão rejeitadas
 * @returns {Object} 200 - Resumo das solicitações rejeitadas e puladas
 * 
 * @example
 * POST /api/friendships/bulk-reject
 * { "friendIds": ["UID1", "UID2"] }
 * 
 * @throws {400} Erro se tentar rejeitar solicitações enviadas (usar bulk-cancel).
 * 
 * @note Limpeza de Pendências:
 * - Remove os documentos de amizade bidirecionais e ajusta os contadores de solicitações pendentes.
 * - Garante que o usuário logado só possa rejeitar solicitações destinadas a ele.
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

      // Atualizar contadores (atômico dentro da transação)
      const timestamp = admin.firestore.Timestamp.now();
      const receiverRef = db.collection('users').doc(userId);

      // Quem rejeitou (destinatário): -N pendingRequestsCount
      transaction.update(receiverRef, {
        pendingRequestsCount: admin.firestore.FieldValue.increment(-valid.length),
        updatedAt: timestamp,
      });

      // Cada remetente: -1 sentRequestsCount
      for (const item of valid) {
        const senderData = item.userDoc.data();
        const senderRef = db.collection('users').doc(senderData?.requestedBy || item.friendId);
        transaction.update(senderRef, {
          sentRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: timestamp,
        });
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
 * @name Cancelar Amizades em Lote
 * @summary Cancela múltiplas solicitações enviadas.
 * @description Cancela múltiplas solicitações de amizade enviadas pelo usuário logado 
 * de forma atômica. Apenas solicitações pendentes e enviadas pelo autor podem ser canceladas.
 * 
 * @route {POST} /api/friendships/bulk-cancel
 * @bodyparams {string[]} friendIds - Lista de IDs de usuários cujas solicitações serão canceladas
 * @returns {Object} 200 - Resumo das solicitações canceladas e puladas
 * 
 * @example
 * POST /api/friendships/bulk-cancel
 * { "friendIds": ["UID_ENVIADO1"] }
 * 
 * @note Cancelamento Seguro:
 * - Permite que o remetente remova convites antes de serem aceitos.
 * - Atualiza `sentRequestsCount` para o autor e `pendingRequestsCount` para os destinatários.
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

      // Atualizar contadores (atômico dentro da transação)
      const timestamp = admin.firestore.Timestamp.now();
      const senderRef = db.collection('users').doc(userId);

      // Quem cancelou (remetente): -N sentRequestsCount
      transaction.update(senderRef, {
        sentRequestsCount: admin.firestore.FieldValue.increment(-valid.length),
        updatedAt: timestamp,
      });

      // Cada destinatário: -1 pendingRequestsCount
      for (const item of valid) {
        const receiverRef = db.collection('users').doc(item.friendId);
        transaction.update(receiverRef, {
          pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: timestamp,
        });
      }
    });
    logger.info(`Bulk cancel: ${userId} cancelou ${results.cancelled.length}/${friendIds.length} solicitações`);

    // ==== ==== INVALIDAR CACHE ==== ====
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

// =============================================================================
// SINCRONIZAÇÃO E MANUTENÇÃO
// =============================================================================

// Limite atômico do Firestore
const FIRESTORE_BATCH_LIMIT = 500;

/**
 * @name Sincronizar Perfil
 * @summary Atualiza dados denormalizados nas amizades.
 * @description Atualiza dados denormalizados do usuário (nome, foto, etc) em todos os
 * documentos de amizade onde ele aparece como amigo. Deve ser chamado após edição de perfil.
 * 
 * @route {POST} /api/friendships/sync-profile
 * @returns {Object} 200 - Resumo da sincronização com contagem de documentos atualizados
 * 
 * @example
 * POST /api/friendships/sync-profile
 * 
 * @note Consistência Eventual e Lotes:
 * - A sincronização é necessária porque os dados do perfil (nome, foto) são denormalizados em cada documento de amizade para evitar joins custosos.
 * - Utiliza a constante `FIRESTORE_BATCH_LIMIT` (500) para processar atualizações em massa sem exceder os limites do SDK.
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

    // 2. Buscar todas as amizades onde o usuário é o 'friend' (o outro lado da relação)
    const friendshipsSnapshot = await db.collection('friendships')
      .where('friendId', '==', userId)
      .get();

    if (friendshipsSnapshot.empty) {
      logger.info(`Sync-profile: nenhuma amizade para atualizar (${userId})`);
      return res.status(200).json({ message: 'Nenhum documento para atualizar', updated: 0 });
    }

    // 3. Processamento em lotes para respeitar limites do Firestore
    const docs = friendshipsSnapshot.docs;
    let updated = 0;

    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT); // Dividir em pedaços de 500

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
 * @name Calcular Amigos Mútuos
 * @summary Compara amigos entre o autor e um alvo.
 * @description Retorna a interseção de amigos aceitos entre o usuário autenticado e um 
 * terceiro, respeitando as configurações de bloqueio.
 * 
 * @route {GET} /api/friendships/mutual/:userId
 * @param {string} userId - ID do usuário alvo para comparação
 * @returns {Object} 200 - Contagem e lista detalhada de amigos em comum
 * 
 * @example
 * GET /api/friendships/mutual/TARGET_UID
 * 
 * @throws {400} Erro se o ID do usuário for inválido ou ausente.
 * @throws {403} Erro se o alvo bloqueou o usuário logado (privacidade).
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

    // ==== ==== BUSCAR AMIGOS EM PARALELO ==== ====
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

    // ==== ==== CRIAR SET DE IDs PARA BUSCA ==== ====
    const currentUserFriendIds = new Set<string>();
    currentUserFriendsSnapshot.docs.forEach(doc => {
      currentUserFriendIds.add(doc.data().friendId);
    });

    // ==== ==== ENCONTRAR INTERSEÇÃO ==== ====
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
 * @name Verificar Status de Amizade
 * @summary Obtém o estado atual da relação com um alvo.
 * @description Retorna uma string identificando a relação: 'none', 'friends', 
 * 'request_sent', 'request_received' ou 'self'.
 * 
 * @route {GET} /api/friendships/status/:userId
 * @param {string} userId - ID do usuário alvo para verificação
 * @returns {Object} 200 - { status: string }
 * 
 * @example
 * GET /api/friendships/status/TARGET_UID
 * 
 * @throws {403} Erro se houver bloqueio impedindo a verificação.
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

    // ==== ==== VERIFICAR BLOQUEIO ==== ====
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

// =============================================================================
// BLOQUEIO E SEGURANÇA
// =============================================================================

/**
 * @name Bloquear Usuário
 * @summary Bloqueia e desfaz amizades instantaneamente.
 * @description Registra um bloqueio no Firestore e inicia uma limpeza atômica (batch) 
 * de qualquer amizade ou solicitação pendente entre os dois usuários.
 * 
 * @route {POST} /api/friendships/block
 * @bodyparam {string} targetUserId - ID do usuário a ser bloqueado
 * @returns {Object} 200 - { message, blockId }
 * 
 * @example
 * POST /api/friendships/block
 * { "targetUserId": "UID_ALVO" }
 * 
 * @throws {400} Erro se tentar bloquear a si mesmo ou dados inválidos.
 * 
 * @note Limpeza Pós-Bloqueio:
 * - Além de criar o registro de bloqueio, a rota remove documentos bidirecionais de `friendships`.
 * - Ajusta os contadores de `friendsCount` e pendências de ambos para manter integridade.
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

    // 1. Executa bloqueio oficial (transactional para atomicidade)
    await db.runTransaction(async (transaction) => {
      const existingBlock = await transaction.get(blockRef);
      if (existingBlock.exists) return;

      transaction.set(blockRef, {
        blockerId: userId,
        blockedId: targetUserId,
        createdAt: admin.firestore.Timestamp.now(),
      });
    });

    logger.info(`Usuário bloqueado: ${userId} -> ${targetUserId}`);

    // 2. Limpeza física de relações existentes (pós-bloqueio)
    const friendship1Ref = db.collection('friendships').doc(`${userId}_${targetUserId}`);
    const friendship2Ref = db.collection('friendships').doc(`${targetUserId}_${userId}`);

    const [doc1, doc2] = await Promise.all([
      friendship1Ref.get(),
      friendship2Ref.get(),
    ]);

    // Processamento de remoção e decremento de contadores se houver amizade
    const batch = db.batch();
    let hadAcceptedFriendship = false;
    let deleteCount = 0;

    if (doc1.exists || doc2.exists) {
      if (doc1.exists) {
        batch.delete(friendship1Ref);
        deleteCount++;
      }
      if (doc2.exists) {
        batch.delete(friendship2Ref);
        deleteCount++;
      }

      const friendshipData = doc1.exists ? doc1.data() : doc2.data();
      const status = friendshipData?.status;
      const requestedBy = friendshipData?.requestedBy;
      const blockTimestamp = admin.firestore.Timestamp.now();

      const userRef = db.collection('users').doc(userId);
      const targetRef = db.collection('users').doc(targetUserId);

      if (status === 'accepted') {
        hadAcceptedFriendship = true;
        batch.update(userRef, {
          friendsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: blockTimestamp,
        });
        batch.update(targetRef, {
          friendsCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: blockTimestamp,
        });
      } else if (status === 'pending') {
        if (requestedBy === userId) {
          batch.update(userRef, {
            sentRequestsCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: blockTimestamp,
          });
          batch.update(targetRef, {
            pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: blockTimestamp,
          });
        } else {
          batch.update(userRef, {
            pendingRequestsCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: blockTimestamp,
          });
          batch.update(targetRef, {
            sentRequestsCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: blockTimestamp,
          });
        }
      }
    }

    if (deleteCount > 0) {
      await batch.commit();
      logger.info(`[Block] Deleted ${deleteCount} friendship docs between ${userId} and ${targetUserId}`);
    }

    // Atualização de amigos mútuos em segundo plano
    if (hadAcceptedFriendship) {
      updateMutualFriendsForRemovedFriendship(userId, targetUserId).catch(err => {
        logger.error('Erro ao atualizar amigos em comum após bloqueio:', err);
      });
    }

    // Invalidar cache de ambos os usuários
    await Promise.all([
      invalidatePattern(CacheKeys.allUserPattern(userId)),
      invalidatePattern(CacheKeys.allUserPattern(targetUserId))
    ]);

    // Audit Log: Usuário bloqueado
    AuditService.logAuditEvent({
      userId,
      action: 'USER_BLOCKED',
      category: 'SOCIAL',
      resourceId: targetUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.toString(),
      requestId: (req as any).requestId
    });

    return res.status(200).json({ message: 'Usuário bloqueado com sucesso', blockId });
  } catch (error) {
    logger.error('Erro ao bloquear usuário:', error);
    return next(error);
  }
});

/**
 * @name Desbloquear Usuário
 * @summary Remove restrição de bloqueio.
 * @description Exclui o registro de bloqueio, permitindo novas solicitações de amizade futuras. 
 * Não restaura amizades deletadas automaticamente.
 * 
 * @route {POST} /api/friendships/unblock
 * @bodyparam {string} targetUserId - ID do usuário a ser desbloqueado
 * @returns {Object} 200 - { message: 'Usuário desbloqueado com sucesso' }
 * 
 * @example
 * POST /api/friendships/unblock
 * { "targetUserId": "UID_ALVO" }
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

    // Audit Log: Usuário desbloqueado
    AuditService.logAuditEvent({
      userId,
      action: 'USER_UNBLOCKED',
      category: 'SOCIAL',
      resourceId: targetUserId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as any).requestId
    });

    return res.status(200).json({ message: 'Usuário desbloqueado com sucesso' });
  } catch (error) {
    logger.error('Erro ao desbloquear usuário:', error);
    return next(error);
  }
});

/**
 * @name Listar Bloqueados
 * @summary Retorna lista de perfis bloqueados.
 * @description Retorna os detalhes básicos (nome, foto, nickname) de todos os usuários
 * que o usuário logado bloqueou, ordenados por data de bloqueio decrescente.
 * 
 * @route {GET} /api/friendships/blocking/list
 * @returns {Object} 200 - { data: Array<UserProfile> }
 * 
 * @example
 * GET /api/friendships/blocking/list
 * 
 * @note Limites da Query:
 * - Atualmente assume que a lista de bloqueados é pequena (<100) para processamento em memória.
 * - Utiliza `Promise.all` para buscar os detalhes de cada perfil após obter os IDs de bloqueio.
 */
router.get('/friendships/blocking/list', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    // ==== ==== BUSCAR BLOQUEIOS ATIVOS ==== ====
    const blocksSnapshot = await db.collection('blocks')
      .where('blockerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    if (blocksSnapshot.empty) {
      return res.json({ data: [] });
    }

    const blockedIds = blocksSnapshot.docs.map(doc => doc.data().blockedId);

    // ==== ==== BUSCAR DETALHES DOS USUÁRIOS ==== ====
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

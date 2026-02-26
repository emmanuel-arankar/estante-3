// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import * as logger from 'firebase-functions/logger';
import { admin, db } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import {
  listNotificationsQuerySchema,
} from './schemas/notifications.schema';
import { getCached, setCache, invalidatePattern, CacheKeys } from './lib/cache';
import { checkOwnership } from './middleware/ownership.middleware';

const router = Router();

// =============================================================================
// ROTAS DE NOTIFICAÇÃO
// =============================================================================

/**
 * @name Listar Notificações
 * @summary Busca notificações do usuário com paginação.
 * @description Retorna a lista de notificações do usuário com suporte a paginação 
 * baseada em cursor e filtro por status de leitura. Utiliza cache de curta duração.
 * 
 * @route {GET} /api/notifications
 * @queryparam {number} [page=1] - Número da página
 * @queryparam {number} [limit=10] - Itens por página
 * @queryparam {boolean} [unreadOnly=false] - Filtrar apenas não lidas
 * @queryparam {string} [cursor] - Cursor para paginação
 * @returns {Object} 200 - Lista de notificações e metadados de paginação
 * @example
 * GET /api/notifications?unreadOnly=true&limit=20
 */
router.get('/notifications', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const validationResult = listNotificationsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { page, limit, unreadOnly, cursor } = validationResult.data;

    // ==== ==== 1. OTIMIZAÇÃO DE CACHE (PAG 1) ==== ====
    const cacheKey = `${CacheKeys.notifications(userId)}:${unreadOnly ? 'unread' : 'all'}`;
    if (page === 1 && !cursor) {
      const cachedData = await getCached<any>(cacheKey);
      if (cachedData) {
        logger.info(`✅ [Cache] HIT: ${cacheKey}`);
        return res.status(200).json(cachedData);
      }
    }

    // ==== ==== 2. CONSTRUÇÃO DA QUERY BASE ==== ====
    let query = db.collection('notifications')
      .where('userId', '==', userId);

    if (unreadOnly) {
      query = query.where('read', '==', false);
    }

    query = query
      .orderBy('createdAt', 'desc')
      .orderBy('__name__', 'desc'); // Tie breaker para cursor estável

    // ==== ==== 3. CONTAGEM TOTAL (AGREGAÇÃO) ==== ====
    const countQuery = query;
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // ==== ==== 4. PAGINAÇÃO: LIMITES E CURSOR ==== ====
    query = query.limit(limit);

    if (cursor) {
      try {
        const values = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        const hydratedValues = values.map((val: any) => {
          if (val && typeof val === 'object' && val._type === 'ts') {
            return new admin.firestore.Timestamp(val.s, val.n);
          }
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
      query = query.offset((page - 1) * limit);
    }

    // ==== ==== 5. EXECUÇÃO DA BUSCA (FIRESTORE) ==== ====
    const snapshot = await query.get();

    // Logs de telemetria para debug em desenvolvimento
    logger.info(`[Notifications] userId=${userId}, unreadOnly=${unreadOnly}, limit=${limit}`);
    logger.info(`[Notifications] Total=${total}, Docs=${snapshot.size}`);

    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        type: data.type,
        actorId: data.actorId,
        actorName: data.actorName,
        actorPhoto: data.actorPhoto,
        read: data.read ?? false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        metadata: data.metadata || {},
      };
    });

    // ==== ==== 6. GERAÇÃO DO PRÓXIMO CURSOR ==== ====
    let nextCursor = null;
    if (snapshot.docs.length === limit) {
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      const data = lastDoc.data();
      const values = [
        data.createdAt && typeof data.createdAt.toMillis === 'function'
          ? { _type: 'ts', s: data.createdAt.seconds, n: data.createdAt.nanoseconds }
          : data.createdAt,
        lastDoc.id,
      ];
      nextCursor = Buffer.from(JSON.stringify(values)).toString('base64');
    }

    const totalPages = Math.ceil(total / limit);

    // ==== ==== 7. SANITIZAÇÃO DE TIMESTAMPS ==== ====
    const sanitizedNotifications = notifications.map((n: any) => ({
      ...n,
      createdAt: n.createdAt?.toDate?.() || n.createdAt,
      updatedAt: n.updatedAt?.toDate?.() || n.updatedAt,
    }));

    const response = {
      data: sanitizedNotifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: !!nextCursor || (page < totalPages),
        nextCursor,
      },
    };

    // ==== ==== 8. PERSISTÊNCIA DE CACHE (30S) ==== ====
    if (!cursor && page === 1) {
      await setCache(cacheKey, response, 30);
    }

    logger.info(`Notificações listadas: ${userId}, ${sanitizedNotifications.length}/${total}`);
    return res.status(200).json(response);
  } catch (error) {
    logger.error('Erro ao listar notificações:', error);
    return next(error);
  }
});

/**
 * @name Marcar como Lida
 * @summary Altera status de uma notificação para lida.
 * @description Atualiza o status de uma notificação específica para 'read: true'. 
 * Verifica se a notificação pertence ao usuário logado.
 * 
 * @route {POST} /api/notifications/:notificationId/read
 * @params {string} notificationId - ID da notificação
 * @returns {Object} 200 - { message: 'Notificação marcada como lida' }
 * @example
 * POST /api/notifications/NOTIF_123/read
 */
router.post('/notifications/:notificationId/read', checkAuth, checkOwnership({ collection: 'notifications', paramName: 'notificationId' }), async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;
    const notificationId = req.params.notificationId as string;

    const notificationRef = db.collection('notifications').doc(notificationId);

    await notificationRef.update({
      read: true,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // ==== ==== INVALIDAR CACHE ==== ====
    await invalidatePattern(`notifications:${userId}:*`);

    logger.info(`Notificação marcada como lida: ${notificationId} por ${userId}`);
    return res.status(200).json({ message: 'Notificação marcada como lida' });
  } catch (error) {
    logger.error('Erro ao marcar notificação como lida:', error);
    return next(error);
  }
});

/**
 * @name Marcar Todas como Lidas
 * @summary Batch update de notificações para lidas.
 * @description Realiza uma operação em lote (batch) para marcar todas as 
 * notificações não lidas do usuário como lidas simultaneamente.
 * 
 * @route {POST} /api/notifications/mark-all-read
 * @returns {Object} 200 - Total de notificações atualizadas
 * @example
 * POST /api/notifications/mark-all-read
 */
router.post('/notifications/mark-all-read', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'Nenhuma notificação não lida', count: 0 });
    }

    const batch = db.batch();
    const timestamp = admin.firestore.Timestamp.now();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        updatedAt: timestamp,
      });
    });

    await batch.commit();

    // ==== ==== INVALIDAR CACHE ==== ====
    await invalidatePattern(`notifications:${userId}:*`);

    logger.info(`${snapshot.size} notificações marcadas como lidas para ${userId}`);
    return res.status(200).json({
      message: 'Todas notificações marcadas como lidas',
      count: snapshot.size,
    });
  } catch (error) {
    logger.error('Erro ao marcar todas como lidas:', error);
    return next(error);
  }
});

/**
 * @name Excluir Notificação
 * @summary Remove permanentemente uma notificação.
 * @description Remove permanentemente um documento de notificação do Firestore. 
 * Requer que o usuário seja o proprietário da notificação.
 * 
 * @route {DELETE} /api/notifications/:notificationId
 * @params {string} notificationId - ID da notificação
 * @returns {Object} 200 - { message: 'Notificação removida com sucesso' }
 * @example
 * DELETE /api/notifications/NOTIF_123
 */
router.delete('/notifications/:notificationId', checkAuth, checkOwnership({ collection: 'notifications', paramName: 'notificationId' }), async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;
    const notificationId = req.params.notificationId as string;

    const notificationRef = db.collection('notifications').doc(notificationId);
    await notificationRef.delete();

    // Invalidar cache
    await invalidatePattern(`notifications:${userId}:*`);

    logger.info(`Notificação removida: ${notificationId} por ${userId}`);
    return res.status(200).json({ message: 'Notificação removida com sucesso' });
  } catch (error) {
    logger.error('Erro ao remover notificação:', error);
    return next(error);
  }
});

/**
 * @name Obter Contagem de Não Lidas
 * @summary Retorna total de notificações pendentes.
 * @description Retorna apenas a contagem total de notificações com status 'read: false'. 
 * Altamente otimizado usando a função count() do Firestore.
 * 
 * @route {GET} /api/notifications/unread-count
 * @returns {Object} 200 - { count: number }
 * @example
 * GET /api/notifications/unread-count
 */
router.get('/notifications/unread-count', checkAuth, async (req: Request, res: Response, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const cacheKey = `${CacheKeys.notifications(userId)}:unread-count`;
    const cached = await getCached<number>(cacheKey);

    if (cached !== null) {
      logger.info(`✅ [Cache] HIT: ${cacheKey}`);
      return res.status(200).json({ count: cached });
    }

    const countSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .count()
      .get();

    const count = countSnapshot.data().count;

    // Cache por 30s
    await setCache(cacheKey, count, 30);

    return res.status(200).json({ count });
  } catch (error) {
    logger.error('Erro ao buscar contador de não lidas:', error);
    return next(error);
  }
});

export default router;

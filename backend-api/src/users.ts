// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import { db } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { validate } from './middleware/validate.middleware';
import { searchLimiter } from './middleware/security.middleware';
import {
  userIdParamSchema,
  updateProfileSchema,
} from './schemas/user.schema';
import { isBlockedBy } from './services/block.service';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { AuditService } from './services/audit.service';
import { asyncHandler } from './middleware/asyncHandler';
import { getCached, setCache, invalidatePattern, CacheKeys } from './lib/cache';
import { generateSearchTerms } from './lib/search';

const router = Router();

// =============================================================================
// ROTAS DE USUÁRIO
// =============================================================================

/**
 * @name Buscar por Nickname
 * @summary Localiza usuário pelo handle.
 * @description Localiza um usuário específico no Firestore através do seu nickname (@handle). 
 * Retorna dados públicos essenciais para a exibição do perfil.
 * 
 * @route {GET} /api/users/by-nickname/:nickname
 * @params {string} nickname - Nickname do usuário (ex: 'joaosilva')
 * @returns {Object} 200 - Dados públicos do perfil encontrado
 * @example
 * GET /api/users/by-nickname/joaosilva
 */
router.get('/users/by-nickname/:nickname', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const { nickname } = req.params;

  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'Nickname é obrigatório' });
  }

  // Cache: perfil por nickname (2 min)
  const cacheKey = CacheKeys.userByNickname(nickname.toLowerCase());
  const cached = await getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  const snapshot = await db.collection('users')
    .where('nickname', '==', nickname.toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  // ==== ==== 1. SELEÇÃO DE CAMPOS PÚBLICOS ==== ====
  const publicProfile = {
    id: userDoc.id,
    displayName: userData?.displayName || 'Usuário',
    nickname: userData?.nickname || '',
    photoURL: userData?.photoURL || null,
    bio: userData?.bio || '',
    location: userData?.location || '',
    website: userData?.website || '',
    birthDate: userData?.birthDate?.toDate?.()?.toISOString() || userData?.birthDate || null,
    coverPhotoURL: userData?.coverPhotoURL || null,
    createdAt: userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt || null,
    joinedAt: userData?.joinedAt?.toDate?.()?.toISOString() || userData?.joinedAt || userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt || null,

    // ==== ==== 2. CONTADORES DE ENGAJAMENTO ==== ====
    // Proteção anti-negativo: FieldValue.increment(-1) não tem floor
    friendsCount: Math.max(0, userData?.friendsCount || 0),
  };

  await setCache(cacheKey, publicProfile, 120);
  return res.json(publicProfile);
}));

/**
 * @name Verificar Disponibilidade de Nickname
 * @summary Checa se um handle está vago.
 * @description Endpoint de utilidade para checar se um nickname já está em uso 
 * antes de permitir que um usuário o escolha ou altere.
 * 
 * @route {GET} /api/users/check-nickname
 * @queryparam {string} nickname - Nickname a ser verificado
 * @returns {Object} 200 - { available: boolean }
 * @example
 * GET /api/users/check-nickname?nickname=novonick
 */
router.get('/users/check-nickname', asyncHandler(async (req: Request, res: Response) => {
  const { nickname } = req.query;

  if (!nickname || typeof nickname !== 'string') {
    return res.status(400).json({ error: 'Nickname é obrigatório' });
  }

  const snapshot = await db.collection('users')
    .where('nickname', '==', nickname.toLowerCase())
    .limit(1)
    .get();

  return res.json({ available: snapshot.empty });
}));

/**
 * @name Pesquisar Usuários
 * @summary Busca textual de usuários.
 * @description Realiza busca textual em nicknames e nomes de exibição. 
 * Suporta busca por prefixo (startAt/endAt) para otimização do Firestore.
 * 
 * @route {GET} /api/users/search
 * @queryparam {string} q - Termo de busca
 * @queryparam {number} [limit=10] - Limite de resultados (máx 20)
 * @returns {Array<Object>} 200 - Lista resumida de usuários compatíveis
 * @example
 * GET /api/users/search?q=joao&limit=5
 */
router.get('/users/search', checkAuth, searchLimiter as any, asyncHandler(async (req: Request, res: Response) => {
  const { q, limit: limitStr } = req.query;
  const searchLimit = Math.min(parseInt(limitStr as string) || 10, 20);

  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json([]);
  }

  const searchTerm = q.toLowerCase();

  logger.info(`Buscando usuários com termo: "${searchTerm}"`);

  // ==== ==== 1. BUSCA OTIMIZADA (array-contains) ==== ====
  // Tenta usar searchTerms primeiro (1 query), fallback para prefix match legado
  let snapshot = await db.collection('users')
    .where('searchTerms', 'array-contains', searchTerm)
    .limit(searchLimit)
    .get();

  // ==== ==== 2. FALLBACK: BUSCA LEGACY POR PREFIX ==== ====
  // Para usuários que ainda não têm searchTerms populado
  if (snapshot.empty) {
    const nicknameSnapshot = await db.collection('users')
      .where('nickname', '>=', searchTerm)
      .where('nickname', '<=', searchTerm + '\uf8ff')
      .limit(searchLimit)
      .get();

    let nameSnapshot = await db.collection('users')
      .where('displayNameLower', '>=', searchTerm)
      .where('displayNameLower', '<=', searchTerm + '\uf8ff')
      .limit(searchLimit)
      .get();

    if (nameSnapshot.empty) {
      const capitalizedTerm = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
      const nameSnapshotCapitalized = await db.collection('users')
        .where('displayName', '>=', capitalizedTerm)
        .where('displayName', '<=', capitalizedTerm + '\uf8ff')
        .limit(searchLimit)
        .get();
      if (!nameSnapshotCapitalized.empty) {
        nameSnapshot = nameSnapshotCapitalized;
      }
    }

    // Combinar resultados do fallback
    const seenIds = new Set<string>();
    const results: Array<{ id: string; label: string; nickname: string; photoURL: string }> = [];

    const addDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);
      const data = doc.data();
      results.push({
        id: doc.id,
        label: data.displayName || 'Usuário',
        nickname: data.nickname || '',
        photoURL: data.photoURL || '',
      });
    };

    nicknameSnapshot.docs.forEach(addDoc);
    nameSnapshot.docs.forEach(addDoc);

    return res.json(results.slice(0, searchLimit));
  }

  // ==== ==== 3. FORMATAR RESULTADOS ==== ====
  const results = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      label: data.displayName || 'Usuário',
      nickname: data.nickname || '',
      photoURL: data.photoURL || '',
    };
  });

  return res.json(results);
}));

/**
 * @name Atualizar Meu Perfil
 * @summary Altera dados do próprio usuário.
 * @description Permite que o usuário autenticado atualize seu nome, nickname, bio, 
 * localização e website. Realiza normalização de nomes e garante exclusividade de nicknames.
 * 
 * @route {PATCH} /api/users/me
 * @bodyparams {UpdateProfileInput} - Dados a serem atualizados
 * @returns {Object} 200 - { success: true, user: Object }
 */
router.patch('/users/me', checkAuth, validate({ body: updateProfileSchema }), asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const currentUserId = authReq.user.uid;

  const updates = req.body;
  const userRef = db.collection('users').doc(currentUserId);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('user-not-found');

      const userData = userDoc.data();
      const currentNickname = userData?.nickname;
      const finalUpdates: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 1. Processar Nickname (se alterado)
      if (updates.nickname && updates.nickname !== currentNickname) {
        const newNickname = updates.nickname.toLowerCase();
        const nicknameRef = db.collection('nicknames').doc(newNickname);
        const nicknameDoc = await transaction.get(nicknameRef);

        if (nicknameDoc.exists) {
          throw new Error('nickname-taken');
        }

        // Liberar nickname antigo e reservar novo
        if (currentNickname) {
          transaction.delete(db.collection('nicknames').doc(currentNickname));
        }
        transaction.set(nicknameRef, { userId: currentUserId });
        finalUpdates.nickname = newNickname;
      }

      // 2. Processar DisplayName e Versão Minúscula para Busca
      if (updates.displayName) {
        finalUpdates.displayName = updates.displayName;
        finalUpdates.displayNameLower = updates.displayName.toLowerCase();

        // Atualizar também no Firebase Auth (background)
        admin.auth().updateUser(currentUserId, {
          displayName: updates.displayName
        }).catch(err => logger.error('Erro ao atualizar displayName no Auth:', err));
      }

      // 3. Outros campos
      if (updates.bio !== undefined) finalUpdates.bio = updates.bio;
      if (updates.website !== undefined) finalUpdates.website = updates.website;
      if (updates.location !== undefined) finalUpdates.location = updates.location;
      if (updates.birthDate !== undefined) {
        finalUpdates.birthDate = updates.birthDate
          ? admin.firestore.Timestamp.fromDate(new Date(updates.birthDate))
          : null;
      }
      if (updates.photoURL !== undefined) {
        finalUpdates.photoURL = updates.photoURL;

        // Atualizar também no Firebase Auth
        admin.auth().updateUser(currentUserId, {
          photoURL: updates.photoURL || undefined
        }).catch(err => logger.error('Erro ao atualizar photoURL no Auth:', err));
      }

      // 5. Gerar searchTerms para busca otimizada
      if (finalUpdates.displayName || finalUpdates.nickname) {
        const finalDisplayName = finalUpdates.displayName || userData?.displayName;
        const finalNickname = finalUpdates.nickname || userData?.nickname;
        finalUpdates.searchTerms = generateSearchTerms(finalDisplayName, finalNickname);
      }

      transaction.update(userRef, finalUpdates);
    });
  } catch (error: any) {
    if (error.message === 'nickname-taken') {
      return res.status(409).json({ error: 'Este nickname já está em uso' });
    }
    if (error.message === 'user-not-found') {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    throw error; // Repassa outros erros para o asyncHandler
  }

  logger.info(`Perfil do usuário ${currentUserId} atualizado com sucesso`);

  // Invalidar cache de perfil (por ID e por nickname)
  await invalidatePattern(CacheKeys.profilePattern(currentUserId));
  if (updates.nickname) {
    await invalidatePattern('nickname:*'); // Invalidar todos os nicknames em cache
  }
  await invalidatePattern(CacheKeys.userStats(currentUserId));

  // Audit Log: Perfil atualizado
  AuditService.logAuditEvent({
    userId: currentUserId,
    action: 'PROFILE_UPDATED',
    category: 'USER',
    metadata: { fields: Object.keys(updates) },
    ip: req.ip,
    userAgent: req.get('User-Agent')?.toString(),
    requestId: (req as any).requestId
  });

  // ==== ==== CASCATA: Propagar dados atualizados para Notificações e Amizades ==== ====
  // Executado de forma assíncrona (fire-and-forget) para não atrasar a resposta
  const hasProfileFieldChanges = updates.displayName || updates.photoURL !== undefined || updates.nickname;

  if (hasProfileFieldChanges) {
    (async () => {
      try {
        // Buscar o documento final atualizado para pegar a nova array `searchTerms`
        const updatedUserDoc = await db.collection('users').doc(currentUserId).get();
        const updatedUserData = updatedUserDoc.data();

        // 1. Atualizar notificações onde este usuário é o ator
        const notifSnapshot = await db.collection('notifications')
          .where('actorId', '==', currentUserId)
          .get();

        if (!notifSnapshot.empty) {
          // Firestore batch suporta até 500 operações
          const batches: admin.firestore.WriteBatch[] = [];
          let currentBatch = db.batch();
          let opCount = 0;

          const notifUpdates: Record<string, any> = {};
          if (updates.displayName) notifUpdates.actorName = updates.displayName;
          if (updates.photoURL !== undefined) notifUpdates.actorPhoto = updates.photoURL || null;
          if (updates.nickname) notifUpdates['metadata.actorNickname'] = updates.nickname;

          for (const doc of notifSnapshot.docs) {
            currentBatch.update(doc.ref, notifUpdates);
            opCount++;
            if (opCount >= 499) {
              batches.push(currentBatch);
              currentBatch = db.batch();
              opCount = 0;
            }
          }
          batches.push(currentBatch);

          await Promise.all(batches.map(b => b.commit()));
          logger.info(`Cascata: ${notifSnapshot.size} notificações atualizadas para ${currentUserId}`);
        }

        // 2. Atualizar documentos de amizade onde este usuário é o amigo
        const friendshipSnapshot = await db.collection('friendships')
          .where('friendId', '==', currentUserId)
          .get();

        if (!friendshipSnapshot.empty) {
          const batches: admin.firestore.WriteBatch[] = [];
          let currentBatch = db.batch();
          let opCount = 0;

          const friendUpdates: Record<string, any> = {};
          if (updates.displayName) friendUpdates['friend.displayName'] = updates.displayName;
          if (updates.photoURL !== undefined) friendUpdates['friend.photoURL'] = updates.photoURL || null;
          if (updates.nickname) friendUpdates['friend.nickname'] = updates.nickname;

          if ((updates.displayName || updates.nickname) && updatedUserData?.searchTerms) {
            friendUpdates['friend.searchTerms'] = updatedUserData.searchTerms;
          }

          for (const doc of friendshipSnapshot.docs) {
            currentBatch.update(doc.ref, friendUpdates);
            opCount++;
            if (opCount >= 499) {
              batches.push(currentBatch);
              currentBatch = db.batch();
              opCount = 0;
            }
          }
          batches.push(currentBatch);

          await Promise.all(batches.map(b => b.commit()));
          logger.info(`Cascata: ${friendshipSnapshot.size} amizades atualizadas para ${currentUserId}`);
        }
      } catch (cascadeError) {
        logger.error('Erro na propagação em cascata (não-bloqueante):', cascadeError);
        // Não falhar a resposta principal se a cascata tiver problemas
      }
    })();
  }

  return res.json({ success: true });
}));

/**
 * @name Minhas Estatísticas
 * @summary Contadores de amizade e pedidos.
 * @description Retorna contadores agregados do usuário logado, como número de amigos 
 * e solicitações pendentes (enviadas e recebidas).
 * 
 * @route {GET} /api/users/me/stats
 * @returns {Object} 200 - Objeto com friendsCount, pendingRequestsCount e sentRequestsCount
 * @example
 * GET /api/users/me/stats
 */
router.get('/users/me/stats', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const currentUserId = authReq.user.uid;

  // Cache: stats do usuário (1 min)
  const cacheKey = CacheKeys.userStats(currentUserId);
  const cached = await getCached<any>(cacheKey);
  if (cached) return res.json(cached);

  const userDoc = await db.collection('users').doc(currentUserId).get();

  if (!userDoc.exists) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const data = userDoc.data();

  // Proteção anti-negativo: condições de corrida podem gerar valores < 0
  const stats = {
    totalFriends: Math.max(0, data?.friendsCount || 0),
    pendingRequests: Math.max(0, data?.pendingRequestsCount || 0),
    sentRequests: Math.max(0, data?.sentRequestsCount || 0),
  };

  await setCache(cacheKey, stats, 60);
  return res.json(stats);
}));

/**
 * @name Obter Perfil por ID
 * @summary Busca perfil público via UID.
 * @description Busca o perfil público de um usuário por seu ID direto. 
 * Implementa verificação de bloqueio para garantir a privacidade.
 * 
 * @route {GET} /api/users/:userId
 * @params {string} userId - ID único do usuário no Firebase
 * @returns {Object} 200 - Dados públicos do perfil
 * @example
 * GET /api/users/ID_DO_USUARIO
 */
router.get('/users/:userId', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const currentUserId = authReq.user.uid;

  const validationResult = userIdParamSchema.safeParse(req.params);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { userId: targetUserId } = validationResult.data;

  // Cache: perfil por ID (2 min)
  const cacheKey = CacheKeys.userProfile(targetUserId);
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    // Mesmo do cache, verificar bloqueio (sec check)
    const isBlocked = await isBlockedBy(targetUserId, currentUserId);
    if (isBlocked) {
      return res.status(403).json({ error: 'Este perfil não está disponível' });
    }
    return res.json(cached);
  }

  // Verificar se o usuário alvo bloqueou o usuário atual
  const isBlocked = await isBlockedBy(targetUserId, currentUserId);
  if (isBlocked) {
    logger.info(`Acesso ao perfil bloqueado: ${targetUserId} bloqueou ${currentUserId}`);
    return res.status(403).json({
      error: 'Este perfil não está disponível'
    });
  }

  // Buscar dados do usuário
  const userDoc = await db.collection('users').doc(targetUserId).get();

  if (!userDoc.exists) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const userData = userDoc.data();

  // ==== ==== 1. SELEÇÃO DE DADOS PÚBLICOS ==== ====
  const publicProfile = {
    id: userDoc.id,
    displayName: userData?.displayName || 'Usuário',
    nickname: userData?.nickname || '',
    photoURL: userData?.photoURL || null,
    bio: userData?.bio || '',
    location: userData?.location || '',
    website: userData?.website || '',
    birthDate: userData?.birthDate?.toDate?.()?.toISOString() || userData?.birthDate || null,
    coverPhotoURL: userData?.coverPhotoURL || null,
    createdAt: userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt || null,
    joinedAt: userData?.joinedAt?.toDate?.()?.toISOString() || userData?.joinedAt || userData?.createdAt?.toDate?.()?.toISOString() || userData?.createdAt || null,

    // ==== ==== 2. CONTADORES CONSOLIDADOS ==== ====
    // Proteção anti-negativo: FieldValue.increment(-1) não tem floor
    friendsCount: Math.max(0, userData?.friendsCount || 0),
  };

  await setCache(cacheKey, publicProfile, 120);
  return res.json(publicProfile);
}));

// =============================================================================
// AVATAR ENDPOINTS (LEGACY/REFACTORING)
// =============================================================================

/**
 * @name Listar Avatares do Usuário
 * @summary Histórico de fotos de perfil.
 * @description Recupera o histórico de fotos de perfil (avatares) de um usuário, 
 * permitindo visualização de galerias de perfil.
 * 
 * @route {GET} /api/users/:userId/avatars
 * @params {string} userId - ID do usuário
 * @returns {Array<Object>} 200 - Lista de avatares ordenados por data
 * @example
 * GET /api/users/UID123/avatars
 */
router.get('/users/:userId/avatars', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  const snapshot = await db.collection('userAvatars')
    .where('userId', '==', userId)
    .orderBy('uploadedAt', 'desc')
    .limit(20)
    .get();

  const avatars = snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      uploadedAt: data.uploadedAt?.toDate()?.toISOString() || new Date().toISOString(),
    };
  });

  return res.json(avatars);
}));

/**
 * @name Curtir Avatar
 * @summary Alterna like em uma foto de perfil.
 * @description Permite que um usuário curta ou descurta a foto de perfil de outro usuário. 
 * Gerencia a lista de IDs de usuários nas curtidas do documento.
 * 
 * @route {POST} /api/avatars/:avatarId/like
 * @params {string} avatarId - ID único do avatar
 * @returns {Object} 200 - { liked: boolean } indicando o novo estado
 * @example
 * POST /api/avatars/AVATAR_123/like
 */
router.post('/avatars/:avatarId/like', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.uid;
  const { avatarId } = req.params;

  if (!avatarId) {
    return res.status(400).json({ error: 'avatarId é obrigatório' });
  }

  const avatarRef = db.collection('userAvatars').doc(avatarId as string);
  const avatarDoc = await avatarRef.get();

  if (!avatarDoc.exists) {
    return res.status(404).json({ error: 'Avatar não encontrado' });
  }

  const data = avatarDoc.data();
  const likes: string[] = data?.likes || [];
  const isLiked = likes.includes(userId);

  if (isLiked) {
    await avatarRef.update({
      likes: admin.firestore.FieldValue.arrayRemove(userId),
    });
  } else {
    await avatarRef.update({
      likes: admin.firestore.FieldValue.arrayUnion(userId),
    });
  }

  return res.json({ liked: !isLiked });
}));

/**
 * @name Comentar no Avatar
 * @summary Adiciona comentário a uma foto.
 * @description Adiciona um comentário a uma foto de perfil específica. 
 * Armazena o comentário de forma denormalizada dentro do documento do avatar.
 * 
 * @route {POST} /api/avatars/:avatarId/comment
 * @params {string} avatarId - ID único do avatar
 * @bodyparams {string} content - Conteúdo do comentário
 * @returns {Object} 200 - Dados do comentário recém-criado
 * @example
 * POST /api/avatars/AVATAR_123/comment
 * { "content": "Adorei a foto!" }
 */
router.post('/avatars/:avatarId/comment', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.uid;
  const { avatarId } = req.params;
  const { content } = req.body;

  if (!avatarId) {
    return res.status(400).json({ error: 'avatarId é obrigatório' });
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
  }

  const avatarRef = db.collection('userAvatars').doc(avatarId as string);
  const avatarDoc = await avatarRef.get();

  if (!avatarDoc.exists) {
    return res.status(404).json({ error: 'Avatar não encontrado' });
  }

  const commentData = {
    id: Date.now().toString(),
    userId,
    content: content.trim(),
    likes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const data = avatarDoc.data();
  const comments = data?.comments || [];
  comments.push(commentData);

  await avatarRef.update({ comments });

  return res.json(commentData);
}));

/**
 * @name Criar Novo Avatar
 * @summary Registra nova foto de perfil.
 * @description Registra uma nova foto de perfil na coleção `userAvatars` e 
 * marca automaticamente as fotos anteriores como inativas (`isCurrent: false`).
 * 
 * @route {POST} /api/avatars
 * @bodyparams {string} originalUrl - URL da imagem original
 * @bodyparams {string} croppedUrl - URL da imagem cortada
 * @bodyparams {boolean} [isPublic=false] - Se o avatar é visível para todos
 * @bodyparams {Object} [cropData] - Coordenadas de corte da imagem
 * @returns {Object} 200 - Dados do novo avatar registrado
 * @example
 * POST /api/avatars
 * { "originalUrl": "...", "croppedUrl": "...", "isPublic": true }
 */
router.post('/avatars', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.uid;
  const { originalUrl, croppedUrl, isPublic, cropData } = req.body;

  if (!originalUrl || !croppedUrl) {
    return res.status(400).json({ error: 'originalUrl e croppedUrl são obrigatórios' });
  }

  // ==== ==== 1. CRIAR NOVO REGISTRO DE AVATAR ==== ====
  const avatarRef = db.collection('userAvatars').doc();
  const avatarData = {
    userId,
    originalUrl,
    croppedUrl,
    isPublic: isPublic || false,
    cropData: cropData || {},
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    isCurrent: true,
    likes: [],
    comments: [],
  };

  // ==== ==== 2. DESATIVAR AVATARES ANTERIORES ==== ====
  const existingSnapshot = await db.collection('userAvatars')
    .where('userId', '==', userId)
    .where('isCurrent', '==', true)
    .get();

  const batch = db.batch();
  batch.set(avatarRef, avatarData);

  existingSnapshot.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
    if (doc.id !== avatarRef.id) {
      batch.update(doc.ref, { isCurrent: false });
    }
  });

  await batch.commit();

  return res.json({ id: avatarRef.id, ...avatarData });
}));

/**
 * @name Atualizar Foto de Perfil
 * @summary Muda a foto principal do perfil.
 * @description Atualiza de forma rápida a URL da foto de perfil ativa diretamente 
 * no documento principal do usuário no Firestore.
 * 
 * @route {PATCH} /api/users/me/photo
 * @bodyparams {string} photoURL - Nova URL da foto
 * @returns {Object} 200 - { success: true }
 * @example
 * PATCH /api/users/me/photo
 * { "photoURL": "https://..." }
 */
router.patch('/users/me/photo', checkAuth, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.uid;
  const { photoURL } = req.body;

  if (!photoURL || typeof photoURL !== 'string') {
    return res.status(400).json({ error: 'photoURL é obrigatório' });
  }

  await db.collection('users').doc(userId).update({
    photoURL,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}));

export default router;

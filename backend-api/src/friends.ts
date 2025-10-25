import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { findFriendsQuerySchema } from './schemas/friends.schema';

const router = Router();

const FIND_FRIENDS_LIMIT = parseInt(process.env.FIND_FRIENDS_QUERY_LIMIT || '', 10) || 10;
logger.info(`Usando limite de busca de amigos: ${FIND_FRIENDS_LIMIT}`);

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

export default router;
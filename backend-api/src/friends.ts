import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { findFriendsQuerySchema } from './schemas/friends.schema';

const router = Router();

// Lógica de busca dupla (nome e nickname)
router.get('/findFriends', checkAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const loggedInUserId = authReq.user.uid;

    // # atualizado: Validar req.query usando o schema
    const validationResult = findFriendsQuerySchema.safeParse(req.query);

    if (!validationResult.success) {
      // Se a validação falhar, retorna erro 400 com detalhes
      return res.status(400).json({
        error: 'Dados de busca inválidos',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { searchTerm } = validationResult.data;
    const endTerm = searchTerm + '\uf8ff';

    const usersRef = admin.firestore().collection('users');

    // Query 1: Buscar por displayName
    const nameQuery = usersRef
      .where('displayName', '>=', searchTerm)
      .where('displayName', '<=', endTerm)
      .limit(10);

    // Query 2: Buscar por nickname
    // Remove o '@' se o usuário digitou, para buscar no campo 'nickname'
    const nicknameSearch = searchTerm.startsWith('@')
      ? searchTerm.substring(1)
      : searchTerm;
    const endNicknameTerm = nicknameSearch + '\uf8ff';

    const nicknameQuery = usersRef
      .where('nickname', '>=', nicknameSearch)
      .where('nickname', '<=', endNicknameTerm)
      .limit(10);

    // Executar ambas as queries em paralelo
    const [nameSnapshot, nicknameSnapshot] = await Promise.all([
      nameQuery.get(),
      nicknameQuery.get(),
    ]);

    // Usar um Map para mesclar resultados e remover duplicatas
    const usersMap = new Map();

    // Adiciona resultados da busca por nome
    nameSnapshot.docs.forEach(doc => {
      if (doc.id !== loggedInUserId) { // Filtra o usuário logado
        usersMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    // Adiciona resultados da busca por nickname (sobrescreve duplicatas)
    nicknameSnapshot.docs.forEach(doc => {
      if (doc.id !== loggedInUserId) { // Filtra o usuário logado
        usersMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    // Converte o Map de volta para um array
    const users = Array.from(usersMap.values());

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error finding friends:', error);
    // Retorna erro como JSON
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
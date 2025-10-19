import { Router, Request, Response } from 'express'; 
import * as admin from 'firebase-admin';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware'; 

const router = Router();

// Lógica de busca dupla (nome e nickname)
router.get('/findFriends', checkAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const loggedInUserId = authReq.user.uid;
  
  const { searchTerm } = req.query;

  // Validação alinhada ao frontend (min 2 caracteres)
  if (typeof searchTerm !== 'string' || searchTerm.trim().length < 2) {
    return res.status(400).json({ error: 'Search term must be at least 2 characters' });
  }

  const trimmedSearch = searchTerm.trim();
  const endTerm = trimmedSearch + '\uf8ff';

  try {
    const usersRef = admin.firestore().collection('users');

    // Query 1: Buscar por displayName
    const nameQuery = usersRef
      .where('displayName', '>=', trimmedSearch)
      .where('displayName', '<=', endTerm)
      .limit(10);
   
    // Query 2: Buscar por nickname
    // Remove o '@' se o usuário digitou, para buscar no campo 'nickname'
    const nicknameSearch = trimmedSearch.startsWith('@') 
      ? trimmedSearch.substring(1) 
      : trimmedSearch;
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
import { Router, Request, Response } from 'express'; 
import * as admin from 'firebase-admin';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware'; 

const router = Router();

router.get('/findFriends', checkAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const loggedInUserId = authReq.user.uid;
  
  const { searchTerm } = req.query;

  if (typeof searchTerm !== 'string' || searchTerm.trim() === '') {
    return res.status(400).send('Search term is required');
  }

  try {
    const usersRef = admin.firestore().collection('users');
    const query = usersRef
      .where('nickname', '>=', searchTerm)
      .where('nickname', '<=', searchTerm + '\uf8ff')
      .limit(10);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const users = snapshot.docs
      // Bônus: Filtrar para que o usuário não se encontre na busca
      .filter(doc => doc.id !== loggedInUserId) 
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error finding friends:', error);
    return res.status(500).send('Internal Server Error');
  }
});

export default router;
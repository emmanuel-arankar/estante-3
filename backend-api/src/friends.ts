import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

router.get('/findFriends', async (req, res) => {
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

    const users = snapshot.docs.map(doc => ({
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
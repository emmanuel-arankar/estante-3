import { Router, Request, Response } from 'express'; 
import * as admin from 'firebase-admin';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware'; 
import { User } from '../../src/models'; // Adjust path if needed

const router = Router();

router.get('/findFriends', checkAuth, async (req: Request, res: Response) => {
  // # updated: Added extensive logging
  console.log("--- findFriends API called ---"); 
  try {
    const authReq = req as AuthenticatedRequest;
    const loggedInUserId = authReq.user.uid;
    console.log(`Authenticated User ID: ${loggedInUserId}`);

    const searchTermQuery = req.query.searchTerm;
    console.log(`Raw Search Term Query: ${searchTermQuery}`);
    
    if (typeof searchTermQuery !== 'string' || searchTermQuery.trim().length < 2) {
      console.log("Search term invalid.");
      return res.status(400).json({ error: 'Termo de busca inválido (mínimo 2 caracteres).' });
    }
    const searchTerm = searchTermQuery.toLowerCase();
    console.log(`Lowercase Search Term: ${searchTerm}`);

    const friendsCollection = admin.firestore()
      .collection("users")
      .doc(loggedInUserId)
      .collection("denormalizedFriendships");
    console.log(`Querying subcollection: users/${loggedInUserId}/denormalizedFriendships`);

    // Fetch friends with status 'accepted'
    const friendsSnapshot = await friendsCollection.where('status', '==', 'accepted').get();
    console.log(`Found ${friendsSnapshot.size} accepted friendships.`);

    if (friendsSnapshot.empty) {
      console.log("No accepted friendships found, returning empty array.");
      return res.status(200).json([]);
    }

    // Map and log raw data
    const allFriendsData = friendsSnapshot.docs.map(doc => {
      console.log(`Raw friendship doc (${doc.id}):`, JSON.stringify(doc.data())); // Log raw data
      return doc.data().friend as User; 
    }).filter(friend => {
      // # updated: Log if friend data is missing/malformed
      if (!friend || !friend.id) { 
        console.warn("Malformed friend data found in denormalizedFriendships:", friend);
        return false;
      }
      return true;
    });
    console.log(`Mapped ${allFriendsData.length} friend objects.`);
    // # updated: Log the first friend object found (if any) to check structure
    if (allFriendsData.length > 0) {
      console.log("First friend object structure:", JSON.stringify(allFriendsData[0]));
    }


    // Apply filter and log matches/non-matches
    const filteredFriends = allFriendsData.filter(friend => {
      const nameMatch = friend.displayName && 
                        friend.displayName.toLowerCase().includes(searchTerm);
      const nickMatch = friend.nickname && 
                        friend.nickname.toLowerCase().includes(searchTerm);
      // # updated: Log filtering decision
      console.log(`Filtering friend: ID=${friend.id}, Name="${friend.displayName}", Nick="${friend.nickname}". NameMatch=${nameMatch}, NickMatch=${nickMatch}, Keep=${nameMatch || nickMatch}`);
      return nameMatch || nickMatch;
    });
    console.log(`Found ${filteredFriends.length} friends after filtering.`);

    const results = filteredFriends.slice(0, 10); 
    console.log(`Returning ${results.length} results.`);
    console.log("--- findFriends API finished ---");
    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in findFriends API:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    console.log("--- findFriends API finished with error ---");
    return res.status(500).json({ error: errorMessage });
  }
});

export default router;
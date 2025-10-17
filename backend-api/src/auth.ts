import { Router } from 'express';
import * as admin from 'firebase-admin';
import { FirebaseError } from 'firebase-admin/app';

const router = Router();

const QUATORZE_DIAS_EM_MS = 60 * 60 * 24 * 14 * 1000;

/**
 * Cria um cookie de sessão a partir de um ID token do Firebase.
 */
router.post('/sessionLogin', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).send('ID token não fornecido.');
  }

  const expiresIn = QUATORZE_DIAS_EM_MS;

  try {
     const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

     const isProd = process.env.FUNCTIONS_EMULATOR !== 'true';
     const options = { 
      maxAge: expiresIn, 
      httpOnly: true, 
      secure: isProd, 
    };

     res.cookie('__session', sessionCookie, options);
     return res.status(200).send({ status: 'success' });
   } catch (error: any) {
     console.error('Erro ao criar cookie de sessão:', error);

     const firebaseError = error as FirebaseError;
     if (firebaseError.code === 'auth/user-not-found') {
        return res.status(401).send({ error: 'Usuário não encontrado. Por favor, faça login novamente.' });
     }
     if (firebaseError.code === 'auth/invalid-id-token') {
        return res.status(401).send({ error: 'Token inválido. Faça login novamente.' });
     }
     
     return res.status(401).send('Falha na autenticação.');
   }
});

/**
 * Limpa o cookie de sessão para fazer logout.
 */
router.post('/sessionLogout', (req, res) => {
  res.clearCookie('__session');
  return res.status(200).send({ status: 'success' });
});

export default router;
import { Router, Request, Response } from 'express';
import { db } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { userIdParamSchema } from './schemas/user.schema';
import { isBlockedBy } from './services/block.service';
import * as logger from 'firebase-functions/logger';

const router = Router();

/**
 * GET /api/users/:userId
 * Retorna dados públicos do perfil de um usuário
 * Retorna 403 se o usuário solicitante foi bloqueado pelo perfil alvo
 */
router.get('/users/:userId', checkAuth, async (req: Request, res: Response, next) => {
    try {
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

        // Retornar apenas dados públicos do perfil
        const publicProfile = {
            id: userDoc.id,
            displayName: userData?.displayName || 'Usuário',
            nickname: userData?.nickname || '',
            photoURL: userData?.photoURL || null,
            bio: userData?.bio || '',
            location: userData?.location || '',
            coverPhotoURL: userData?.coverPhotoURL || null,
            createdAt: userData?.createdAt,
            friendsCount: userData?.friendsCount || 0,
        };

        return res.json(publicProfile);
    } catch (error) {
        logger.error('Erro ao buscar perfil de usuário:', error);
        return next(error);
    }
});

export default router;

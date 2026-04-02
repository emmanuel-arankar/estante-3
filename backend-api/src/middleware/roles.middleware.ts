import { Request, Response, NextFunction, RequestHandler } from 'express';
import { db } from '../firebase';
import { AuthenticatedRequest } from './auth.middleware';
import * as logger from 'firebase-functions/logger';
import { UserRole } from '@estante/common-types';

/**
 * @name Middleware de Controle de Acesso Baseado em Cargos (RBAC)
 * @summary Restringe acesso a rotas com base no cargo do usuário.
 * @description Verifica o cargo do usuário no documento do Firestore e permite ou nega 
 * o acesso com base em uma lista de cargos permitidos.
 * 
 * @param {UserRole[]} allowedRoles - Lista de cargos autorizados a acessar a rota
 * @returns {RequestHandler} Middleware Express
 * 
 * @example
 * router.get('/admin/stats', checkAuth, checkRole(['admin']), ...)
 */
export const checkRole = (allowedRoles: UserRole[]): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.uid;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            // Busca o documento do usuário para verificar o cargo
            const userDoc = await db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                logger.warn('Usuário autenticado sem documento no Firestore', { userId });
                return res.status(404).json({ error: 'Perfil do usuário não encontrado' });
            }

            const userData = userDoc.data();
            const userRole: UserRole = userData?.role || 'user'; // Fallback para leitor padrão

            if (!allowedRoles.includes(userRole)) {
                logger.warn('Tentativa de acesso não autorizado por cargo', {
                    userId,
                    userRole,
                    requiredRoles: allowedRoles,
                    path: req.path
                });

                return res.status(403).json({
                    error: 'Acesso negado: você não tem permissão necessária para esta ação'
                });
            }

            // Anexa o cargo e os dados à requisição para uso posterior se necessário
            Object.assign(req, {
                userRole,
                userData
            });

            return next();
        } catch (error) {
            logger.error('Erro no middleware de RBAC', error);
            return next(error);
        }
    };

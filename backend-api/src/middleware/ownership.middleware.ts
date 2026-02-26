import { Request, Response, NextFunction, RequestHandler } from 'express';
import { db } from '../firebase';
import { AuthenticatedRequest } from './auth.middleware';
import * as logger from 'firebase-functions/logger';

/**
 * @name Opções de Verificação de Propriedade
 * @summary Configurações para o middleware de ownership.
 */
interface OwnershipOptions {
    collection: string;    // Nome da coleção no Firestore
    paramName: string;     // Nome do parâmetro na URL (ex: 'id', 'avatarId')
    ownerField?: string;   // Campo que armazena o UID do dono (default: 'userId')
}

/**
 * @name Middleware de Propriedade (Ownership)
 * @summary Centraliza a autorização de acesso a recursos.
 * @description Verifica se o documento solicitado existe e se o campo de dono 
 * coincide com o UID do usuário autenticado.
 * 
 * @params {OwnershipOptions} options - Configuração da coleção e parâmetro
 * @returns {RequestHandler} Middleware Express
 * 
 * @example
 * router.delete('/avatars/:avatarId', checkAuth, checkOwnership({ collection: 'userAvatars', paramName: 'avatarId' }), ...)
 */
export const checkOwnership = (options: OwnershipOptions): RequestHandler =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authReq = req as AuthenticatedRequest;
            const currentUserId = authReq.user?.uid;
            const resourceIdRaw = req.params[options.paramName];
            const resourceId = Array.isArray(resourceIdRaw) ? resourceIdRaw[0] : resourceIdRaw;
            const ownerField = options.ownerField || 'userId';

            if (!currentUserId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            if (!resourceId) {
                return res.status(400).json({ error: `Parâmetro ${options.paramName} não fornecido` });
            }

            // Busca o recurso no Firestore
            const docRef = db.collection(options.collection).doc(resourceId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                logger.warn('Tentativa de acesso a recurso inexistente', {
                    collection: options.collection,
                    id: resourceId
                });
                return res.status(404).json({ error: 'Recurso não encontrado' });
            }

            const data = docSnap.data();
            const resourceOwner = data?.[ownerField];

            // Validação de Propriedade
            if (resourceOwner !== currentUserId) {
                logger.warn('Acesso negado: Usuário não é o dono do recurso', {
                    userId: currentUserId,
                    ownerId: resourceOwner,
                    resourceId
                });
                return res.status(403).json({
                    error: 'Acesso negado: Você não tem permissão para modificar este recurso'
                });
            }

            // Anexar o documento à requisição para evitar dupla leitura na rota
            (req as any).resourceData = data;

            return next();
        } catch (error) {
            logger.error('Erro no middleware de ownership', error);
            return next(error);
        }
    };

/**
 * @name Middleware de Propriedade do Storage
 * @summary Valida posse de arquivos no bucket via caminho.
 * @description Verifica se o caminho do arquivo (no body ou query) contém o UID do usuário.
 */
export const checkStorageOwnership: RequestHandler = (req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.uid;
    const path = req.body.path || req.query.path as string;

    if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });
    if (!path) return res.status(400).json({ error: 'Caminho do arquivo não fornecido' });

    // O caminho gerado pelo nosso backend sempre segue o padrão: folder/userId/timestamp_name
    if (!path.includes(`/${userId}/`)) {
        logger.warn('Tentativa de acesso não autorizado ao Storage', { userId, path });
        return res.status(403).json({ error: 'Acesso negado: Você não tem permissão para este arquivo' });
    }

    return next();
};

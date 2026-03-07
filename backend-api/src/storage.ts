// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { Router, Request, Response } from 'express';
import { bucket } from './firebase';
import { checkAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { checkStorageOwnership } from './middleware/ownership.middleware';
import { getSignedUrlSchema } from './schemas/storage.schema';
import * as logger from 'firebase-functions/logger';
import { AuditService } from './services/audit.service';

const router = Router();

// =============================================================================
// ROTAS DE STORAGE
// =============================================================================

/**
 * @name Gerar URL Assinada
 * @summary Cria um link temporário para upload direto.
 * @description Permite que o cliente faça upload direto para o Google Cloud Storage
 * sem passar os bits pelo backend, mantendo a segurança via assinatura v4.
 * 
 * @route {POST} /api/storage/signed-url
 * @bodyparams {GetSignedUrlInput}
 */
router.post('/storage/signed-url', checkAuth, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user.uid;
        const validData = getSignedUrlSchema.safeParse(req.body);

        if (!validData.success) {
            return res.status(400).json({
                error: 'Dados inválidos',
                details: validData.error.flatten().fieldErrors
            });
        }

        const { fileName, contentType, folder } = validData.data;

        // Gerar caminho seguro: pasta/userId/timestamp_nome
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `${folder}/${userId}/${Date.now()}_${safeFileName}`;
        const file = bucket.file(path);

        // Gerar URL assinada v4 (requer que a Service Account tenha permissões de Service Account Token Creator)
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // Expira em 15 minutos
            contentType,
        });

        logger.info(`URL assinada gerada para o usuário ${userId}: ${path}`);

        // Audit Log: URL de upload gerada
        AuditService.logAuditEvent({
            userId,
            action: 'FILE_UPLOADED', // Consideramos o início do upload
            category: 'CONTENT',
            resourceId: path,
            metadata: { folder, fileName },
            ip: req.ip,
            userAgent: req.get('User-Agent')?.toString(),
            requestId: (req as any).requestId
        });

        return res.json({
            uploadUrl: url,
            fileUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media`,
            path
        });

    } catch (error) {
        logger.error('Erro ao gerar signed URL:', error);
        return next(error);
    }
});

/**
 * @name Excluir Arquivo
 * @summary Remove um objeto do bucket de forma segura.
 * @description Verifica se o caminho do arquivo contém o UID do usuário para evitar 
 * que um usuário apague arquivos de outros.
 * 
 * @route {DELETE} /api/storage
 * @bodyparams { path: string }
 */
router.delete('/storage', checkAuth, checkStorageOwnership, async (req: Request, res: Response, next) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user.uid;
        const { path } = req.body;

        const file = bucket.file(path);
        const [exists] = await file.exists();

        if (!exists) {
            return res.status(404).json({ error: 'Arquivo não encontrado' });
        }

        await file.delete();
        logger.info(`Arquivo excluído pelo usuário ${userId}: ${path}`);

        // Audit Log: Arquivo excluído
        AuditService.logAuditEvent({
            userId,
            action: 'FILE_DELETED',
            category: 'CONTENT',
            resourceId: path,
            ip: req.ip,
            userAgent: req.get('User-Agent')?.toString(),
            requestId: (req as any).requestId
        });

        return res.json({ success: true });

    } catch (error) {
        logger.error('Erro ao excluir arquivo:', error);
        return next(error);
    }
});

export default router;

import { z } from 'zod';

/**
 * @name Schema de URL Assinada
 * @summary Valida requisição para upload seguro.
 */
export const getSignedUrlSchema = z.object({
    fileName: z.string().min(1, 'Nome do arquivo é obrigatório'),
    contentType: z.string().min(1, 'Tipo de conteúdo é obrigatório'),
    folder: z.enum(['avatars', 'chats', 'posts']).default('posts'),
});

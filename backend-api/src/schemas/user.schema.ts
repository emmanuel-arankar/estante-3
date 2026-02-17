import { z } from 'zod';

/**
 * Schema para validar o parâmetro userId em rotas
 */
export const userIdParamSchema = z.object({
    userId: z.string().min(1, 'userId é obrigatório'),
});

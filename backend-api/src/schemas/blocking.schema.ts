import { z } from 'zod';

export const blockUserSchema = z.object({
    targetUserId: z.string().min(1, 'ID do usuário é obrigatório'),
});

export const unblockUserSchema = z.object({
    targetUserId: z.string().min(1, 'ID do usuário é obrigatório'),
});

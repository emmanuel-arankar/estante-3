import { z } from 'zod';

export const findFriendsQuerySchema = z.object({
  searchTerm: z.string()
    .trim() // Remove espaços extras
    .min(2, { message: 'O termo de busca deve ter no mínimo 2 caracteres' })
});
import { z } from 'zod';

export const sessionLoginBodySchema = z.object({
  idToken: z.string().min(1, { message: 'ID token não pode ser vazio' }),
  rememberMe: z.boolean().optional()
});
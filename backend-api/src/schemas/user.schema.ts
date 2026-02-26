// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';
import { sanitize } from '../lib/sanitize';

/**
 * @name Schema de ID de Usuário
 * @summary Valida identificador de usuário.
 * @description Validação do parâmetro userId em rotas que dependem do UID.
 * 
 * @property {string} userId - Identificador único do usuário no {@link auth}
 * @example
 * { "userId": "UID_USER_123" }
 */
export const userIdParamSchema = z.object({
  userId: z.string().min(1, 'userId é obrigatório'),
});

/**
 * @name Tipo UserIdParam
 * @summary Tipo inferido para parâmetro de usuário.
 * @description Validação do UID do usuário em rotas de perfil e estatísticas.
 * 
 * @typedef {z.infer<typeof userIdParamSchema>} UserIdParam
 */
export type UserIdParam = z.infer<typeof userIdParamSchema>;

/**
 * @name Schema de Atualização de Perfil
 * @summary Valida dados de edição de perfil.
 * @description Define as regras para atualização de campos como bio, localização e nickname.
 * 
 * @property {string} displayName - Nome de exibição do usuário
 * @property {string} nickname - Nickname do usuário
 * @property {string} bio - Biografia do usuário
 * @property {string | {state: string, stateCode: string, city: string}} location - Localização do usuário
 * @property {string} website - Website do usuário
 * @property {string} birthDate - Data de nascimento do usuário
 * @example
 * {
 *  "displayName": "John Doe",
 *  "nickname": "johndoe",
 *  "bio": "Bio do usuário",
 *  "location": "São Paulo, SP",
 *  "website": "https://johndoe.com",
 *  "birthDate": "1990-01-01"
 * }
 */
export const updateProfileSchema = z.object({
  displayName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50).optional()
    .transform(val => val ? sanitize(val) : val),
  nickname: z.string().min(3, 'Nickname deve ter pelo menos 3 caracteres')
    .max(30)
    .regex(/^[a-z0-9_-]+$/, 'Nickname só pode conter letras minúsculas, números, hífens e underscores')
    .optional(),
  bio: z.string().max(200, 'Bio deve ter no máximo 200 caracteres').optional()
    .transform(val => val ? sanitize(val) : val),
  location: z.union([
    z.string(),
    z.object({
      state: z.string(),
      stateCode: z.string(),
      city: z.string(),
    })
  ]).optional(),
  website: z.string().url('URL do website inválida').or(z.literal('')).optional(),
  birthDate: z.string().datetime().nullable().optional(),
  photoURL: z.string().url('URL da foto inválida').or(z.literal('')).optional(),
});

/**
 * @name Tipo UpdateProfileInput
 * @summary Tipo inferido para atualização de perfil.
 * @description Validação dos dados de edição de perfil.
 * 
 * @typedef {z.infer<typeof updateProfileSchema>} UpdateProfileInput
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

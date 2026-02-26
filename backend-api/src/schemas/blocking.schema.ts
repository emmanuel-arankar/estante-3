// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';

/**
 * @name Schema de Bloqueio
 * @summary Valida ação de bloquear usuário.
 * @description Validação do corpo para registro de um novo bloqueio.
 * 
 * @property {string} targetUserId - ID do usuário alvo {@link admin.auth.UserRecord}
 * @example
 * { "targetUserId": "UID_ALVO" }
 */
export const blockUserSchema = z.object({
  targetUserId: z.string().min(1, 'ID do usuário é obrigatório'),
});

/**
 * @name Tipo BlockUserBody
 * @summary Tipo inferido para bloqueio.
 * @description Estrutura do corpo da requisição para bloquear um usuário.
 * 
 * @typedef {z.infer<typeof blockUserSchema>} BlockUserBody
 */
export type BlockUserBody = z.infer<typeof blockUserSchema>;

/**
 * @name Schema de Desbloqueio
 * @summary Valida ação de desbloquear usuário.
 * @description Validação do corpo para remoção de um bloqueio existente.
 * 
 * @property {string} targetUserId - ID do usuário para remover bloqueio {@link admin.auth.UserRecord}
 * @example
 * { "targetUserId": "UID_BLOQUEADO" }
 */
export const unblockUserSchema = z.object({
  targetUserId: z.string().min(1, 'ID do usuário é obrigatório'),
});

/**
 * @name Tipo UnblockUserBody
 * @summary Tipo inferido para desbloqueio.
 * @description Estrutura do corpo da requisição para remover um bloqueio.
 * 
 * @typedef {z.infer<typeof unblockUserSchema>} UnblockUserBody
 */
export type UnblockUserBody = z.infer<typeof unblockUserSchema>;

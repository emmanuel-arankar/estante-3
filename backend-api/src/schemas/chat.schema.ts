// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';
import { sanitize } from '../lib/sanitize';

/**
 * @name Schema de Envio de Mensagem
 * @summary Valida o corpo da requisição de envio de mensagem de chat.
 * @description Valida o corpo da requisição de envio de mensagem de chat.
 * 
 * @property receiverId - ID do destinatário
 * @property content - Conteúdo da mensagem
 * @property type - Tipo da mensagem
 * @property replyTo - Mensagem respondida
 * @property waveform - Onda de áudio
 * @property duration - Duração do áudio
 * @property caption - Legenda da imagem
 * @property viewOnce - Visualização única
 * @property images - Imagens da mensagem
 * @returns {z.ZodObject} O schema de validação de envio de mensagem de chat.
 * @example
 * sendMessageSchema.parse({
 *   receiverId: '123',
 *   content: 'Hello',
 *   type: 'text',
 * });
 */
export const sendMessageSchema = z.object({
    receiverId: z.string().min(1, 'receiverId é obrigatório'),
    content: z.string().min(1, 'Conteúdo não pode ser vazio')
        .transform(val => (sanitize(val) as string)),
    type: z.enum(['text', 'image', 'audio', 'book', 'location']).default('text'),
    replyTo: z.object({
        id: z.string(),
        senderId: z.string(),
        content: z.string(),
        type: z.string(),
    }).optional(),
    waveform: z.array(z.number()).optional(),
    duration: z.number().optional(),
    caption: z.string().optional()
        .transform(val => val ? (sanitize(val) as string) : val),
    viewOnce: z.boolean().optional(),
    images: z.array(z.string()).optional(),
    customId: z.string().optional(),
});

/**
 * @name Schema de Atualização de Mensagem
 * @summary Valida campos de metadados de uma mensagem (leitura, reprodução, edição).
 * @description Valida campos de metadados de uma mensagem (leitura, reprodução, edição).
 * 
 * @property readAt - Data de leitura
 * @property playedAt - Data de reprodução
 * @property viewedAt - Data de visualização
 * @property content - Conteúdo da mensagem
 * @property otherId - ID do destinatário
 * @returns {z.ZodObject} O schema de validação de atualização de mensagem.
 * @example
 * updateMessageSchema.parse({
 *   readAt: true,
 *   playedAt: true,
 *   viewedAt: true,
 *   content: 'Hello',
 *   otherId: '123',
 * });
 */
export const updateMessageSchema = z.object({
    readAt: z.boolean().optional(),
    playedAt: z.boolean().optional(),
    viewedAt: z.boolean().optional(),
    content: z.string().optional()
        .transform(val => val ? (sanitize(val) as string) : val),
    otherId: z.string().min(1),
});

/**
 * @name Schema de Reação de Mensagem
 * @summary Valida dados para adicionar/remover reação em uma mensagem.
 * @description Valida dados para adicionar/remover reação em uma mensagem.
 * 
 * @property emoji - Emoji da reação
 * @property otherId - ID do destinatário
 * @returns {z.ZodObject} O schema de validação de reação de mensagem.
 * @example
 * toggleReactionSchema.parse({
 *   emoji: '👍',
 *   otherId: '123',
 * });
 */
export const toggleReactionSchema = z.object({
    emoji: z.string().min(1),
    otherId: z.string().min(1),
});

/**
 * @name Schema de Presença
 * @summary Valida o status de online/offline do usuário.
 * @description Valida o status de online/offline do usuário.
 * 
 * @property online - Status de presença
 * @returns {z.ZodObject} O schema de validação de presença.
 * @example
 * presenceSchema.parse({
 *   online: true,
 * });
 */
export const presenceSchema = z.object({
    online: z.boolean(),
});

/**
 * @name Schema de Digitação
 * @summary Valida o status de digitação/gravação.
 * @description Valida o status de digitação/gravação.
 * 
 * @property receiverId - ID do destinatário
 * @property status - Status de digitação
 * @returns {z.ZodObject} O schema de validação de digitação.
 * @example
 * typingSchema.parse({
 *   receiverId: '123',
 *   status: true,
 * });
 */
export const typingSchema = z.object({
    receiverId: z.string().min(1, 'receiverId é obrigatório'),
    status: z.union([z.boolean(), z.literal('recording')]),
});

/**
 * @name Schema de Transcrição
 * @summary Valida dados para transcrição de mensagem de áudio.
 * @description Valida dados para transcrição de mensagem de áudio.
 * 
 * @property chatId - ID do chat
 * @property messageId - ID da mensagem
 * @returns {z.ZodObject} O schema de validação de transcrição.
 * @example
 * transcriptionSchema.parse({
 *   chatId: '123',
 *   messageId: '123',
 * });
 */
export const transcriptionSchema = z.object({
    chatId: z.string().min(1, 'chatId é obrigatório'),
    messageId: z.string().min(1, 'messageId é obrigatório'),
});

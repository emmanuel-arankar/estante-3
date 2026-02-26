// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { z } from 'zod';

/**
 * @name Schema de Login de Sessão
 * @summary Esquema de validação para criação de cookie.
 * @description Validação do corpo da requisição de login de sessão para persistência.
 * 
 * @property {string} idToken - Token de ID gerado pelo Firebase Client SDK
 * @property {boolean} [rememberMe] - Flag de persistência da sessão
 * @example
 * // Payload de login persistente
 * { "idToken": "eyJhbG...", "rememberMe": true }
 */
export const sessionLoginBodySchema = z.object({
  idToken: z.string().min(1, { message: 'ID token não pode ser vazio' }),
  rememberMe: z.boolean().optional()
});

/**
 * @name Tipo SessionLoginBody
 * @summary Tipo inferido para login de sessão.
 * @description Representa o corpo da requisição para criar uma sessão de autenticação.
 * 
 * @typedef {z.infer<typeof sessionLoginBodySchema>} SessionLoginBody
 */
export type SessionLoginBody = z.infer<typeof sessionLoginBodySchema>;

/**
 * @name Schema de Registro
 * @summary Esquema para novo cadastro de usuário.
 * @description Validação dos dados necessários para registrar um perfil inicial.
 * 
 * @property {string} email - Endereço de e-mail único e válido
 * @property {string} password - Senha (mínimo 6 caracteres)
 * @property {string} displayName - Nome de exibição
 * @example
 * // Cadastro padrão
 * { "email": "joao@email.com", "password": "senha_segura", "displayName": "João" }
 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

/**
 * @name Tipo RegisterBody
 * @summary Tipo inferido para registro de usuário.
 * @description Representa os campos necessários para realizar um novo cadastro no sistema.
 * 
 * @typedef {z.infer<typeof registerSchema>} RegisterBody
 */
export type RegisterBody = z.infer<typeof registerSchema>;

/**
 * @name Schema de Login
 * @summary Esquema para autenticação email/senha.
 * @description Validação simples de credenciais de acesso.
 * 
 * @property {string} email - E-mail do usuário
 * @property {string} password - Senha de acesso
 * @example
 * { "email": "user@example.com", "password": "password123" }
 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * @name Tipo LoginBody
 * @summary Tipo inferido para login email/senha.
 * @description Estrutura de dados para a autenticação padrão via e-mail.
 * 
 * @typedef {z.infer<typeof loginSchema>} LoginBody
 */
export type LoginBody = z.infer<typeof loginSchema>;

/**
 * @name Schema de Recuperação
 * @summary Esquema para reset de senha.
 * @description Validação do e-mail para envio de link de recuperação.
 * 
 * @property {string} email - E-mail para recuperação
 * @example
 * { "email": "user@example.com" }
 */
export const recoverSchema = z.object({
  email: z.string().email(),
});

/**
 * @name Tipo RecoverBody
 * @summary Tipo inferido para recuperação de conta.
 * @description Dados para solicitação de link de redefinição de senha.
 * 
 * @typedef {z.infer<typeof recoverSchema>} RecoverBody
 */
export type RecoverBody = z.infer<typeof recoverSchema>;

/**
 * @name Schema de Google Auth
 * @summary Esquema para callback de login social.
 * @description Validação dos dados recebidos após autenticação via Google.
 * 
 * @property {string} uid - Identificador único do Firebase
 * @property {string} email - E-mail do proprietário
 * @property {string} displayName - Nome do perfil Google
 * @property {string} [photoURL] - URL do avatar (opcional/nullable)
 * @example
 * { "uid": "G123", "email": "user@gmail.com", "displayName": "Google User" }
 */
export const googleAuthSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().nullable().optional(),
});

/**
 * @name Tipo GoogleAuthBody
 * @summary Tipo inferido para autenticação social.
 * @description Estrutura de dados recebida após o login bem-sucedido com Google.
 * 
 * @typedef {z.infer<typeof googleAuthSchema>} GoogleAuthBody
 */
export type GoogleAuthBody = z.infer<typeof googleAuthSchema>;
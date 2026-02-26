// =============================================================================
// IMPORTS E DEPENDÊNCIAS
// =============================================================================

import { db } from '../firebase';

// =============================================================================
// SERVIÇOS DE BLOQUEIO DE USUÁRIO
// =============================================================================

// ==== ==== OPERAÇÕES DE CONSULTA (BLOCKS) ==== ====

/**
 * @name Verificar Status de Bloqueio
 * @summary Checa bloqueio bidirecional entre usuários.
 * @description Verifica se existe um bloqueio ativo entre dois usuários em qualquer direção.
 * Consulta a coleção 'blocks' procurando por documentos com o ID composto em ambos os sentidos.
 * 
 * @note O bloqueio é bidirecional para garantir a privacidade total: se A bloqueia B,
 * B não vê A, e A também não vê B (para evitar stalking reverso).
 * 
 * @params {string} userId1 - ID do primeiro usuário
 * @params {string} userId2 - ID do segundo usuário
 * @returns {Promise<boolean>} True se houver bloqueio em qualquer direção.
 * @see {@link db} para acesso ao banco de dados.
 * @example
 * const blocked = await checkBlockStatus("UID1", "UID2");
 */
export const checkBlockStatus = async (userId1: string, userId2: string): Promise<boolean> => {
  const blockRef1 = db.collection('blocks').doc(`${userId1}_${userId2}`); // userId1 bloqueou userId2
  const blockRef2 = db.collection('blocks').doc(`${userId2}_${userId1}`); // userId2 bloqueou userId1

  const [doc1, doc2] = await Promise.all([blockRef1.get(), blockRef2.get()]);

  return doc1.exists || doc2.exists;
};

/**
 * @name Está Bloqueado Por
 * @summary Verifica se um usuário bloqueou o outro.
 * @description Verifica se um usuário específico bloqueou outro (direção única).
 * 
 * @params {string} blockerId - ID do usuário que possivelmente bloqueou
 * @params {string} blockedId - ID do usuário possivelmente bloqueado
 * @returns {Promise<boolean>} True se blockerId bloqueou blockedId
 * @example
 * const isBlocked = await isBlockedBy("blockerUID", "targetUID");
 */
export const isBlockedBy = async (blockerId: string, blockedId: string): Promise<boolean> => {
  const blockRef = db.collection('blocks').doc(`${blockerId}_${blockedId}`);
  const doc = await blockRef.get();
  return doc.exists;
};

// ==== ==== UTILITÁRIOS DE VALIDAÇÃO ==== ====

/**
 * @name Garantir Não Bloqueado
 * @summary Validação de segurança anti-bloqueio.
 * @description Garante que não haja bloqueio entre dois usuários, lançando um erro caso exista.
 * 
 * @params {string} userId1 - ID do primeiro usuário
 * @params {string} userId2 - ID do segundo usuário
 * @throws {Error} Lança erro com status 403 (implícito) se houver bloqueio.
 * @see {@link checkBlockStatus} para a lógica de verificação subjacente.
 * @example
 * await ensureNotBlocked(meuId, outroId);
 */
export const ensureNotBlocked = async (userId1: string, userId2: string) => {
  const isBlocked = await checkBlockStatus(userId1, userId2);
  if (isBlocked) {
    throw new Error('Ação não permitida devido a bloqueio.');
  }
};

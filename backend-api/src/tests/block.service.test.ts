// =============================================================================
// TESTES UNITÁRIOS: BLOCK SERVICE
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkBlockStatus, isBlockedBy, ensureNotBlocked } from '../services/block.service';
import { db } from '../firebase';

// =============================================================================
// MOCKS E CONFIGURAÇÃO
// =============================================================================

vi.mock('../firebase', () => ({
    db: {
        collection: vi.fn(),
    },
}));

describe('BlockService', () => {
    const userId1 = 'user_abc';
    const userId2 = 'user_xyz';

    // Snapshots: o que o Firestore retorna após o .get()
    const mockSnapshotExists = { exists: true };
    const mockSnapshotNotExists = { exists: false };

    // DocRef Mock: o que o Firestore retorna no .doc()
    const createMockDocRef = (snapshot: any) => ({
        get: vi.fn().mockResolvedValue(snapshot),
    });

    // Função mock para o .doc()
    let mockDocFn: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDocFn = vi.fn();
        (db.collection as any).mockReturnValue({ doc: mockDocFn });
    });

    // =============================================================================
    // TESTES: checkBlockStatus
    // =============================================================================

    describe('checkBlockStatus', () => {
        it('deve retornar true se userId1 bloqueou userId2', async () => {
            mockDocFn
                .mockReturnValueOnce(createMockDocRef(mockSnapshotExists))    // user_abc_user_xyz
                .mockReturnValueOnce(createMockDocRef(mockSnapshotNotExists)); // user_xyz_user_abc

            const result = await checkBlockStatus(userId1, userId2);

            expect(result).toBe(true);
            expect(mockDocFn).toHaveBeenCalledWith(`${userId1}_${userId2}`);
            expect(mockDocFn).toHaveBeenCalledWith(`${userId2}_${userId1}`);
        });

        it('deve retornar true se userId2 bloqueou userId1', async () => {
            mockDocFn
                .mockReturnValueOnce(createMockDocRef(mockSnapshotNotExists))
                .mockReturnValueOnce(createMockDocRef(mockSnapshotExists));

            const result = await checkBlockStatus(userId1, userId2);

            expect(result).toBe(true);
        });

        it('deve retornar false se nenhum usuário estiver bloqueado', async () => {
            mockDocFn
                .mockReturnValueOnce(createMockDocRef(mockSnapshotNotExists))
                .mockReturnValueOnce(createMockDocRef(mockSnapshotNotExists));

            const result = await checkBlockStatus(userId1, userId2);

            expect(result).toBe(false);
        });
    });

    // =============================================================================
    // TESTES: isBlockedBy
    // =============================================================================

    describe('isBlockedBy', () => {
        it('deve retornar true se a direção específica de bloqueio existir', async () => {
            mockDocFn.mockReturnValue(createMockDocRef(mockSnapshotExists));

            const result = await isBlockedBy(userId1, userId2);

            expect(result).toBe(true);
            expect(mockDocFn).toHaveBeenCalledWith(`${userId1}_${userId2}`);
        });

        it('deve retornar false se a direção específica não existir', async () => {
            mockDocFn.mockReturnValue(createMockDocRef(mockSnapshotNotExists));

            const result = await isBlockedBy(userId1, userId2);

            expect(result).toBe(false);
        });
    });

    // =============================================================================
    // TESTES: ensureNotBlocked
    // =============================================================================

    describe('ensureNotBlocked', () => {
        it('não deve lançar erro se não houver bloqueio', async () => {
            // checkBlockStatus será chamado. Mockamos ambas as direções como não existentes.
            mockDocFn.mockReturnValue(createMockDocRef(mockSnapshotNotExists));

            await expect(ensureNotBlocked(userId1, userId2)).resolves.not.toThrow();
        });

        it('deve lançar erro se houver bloqueio detectado', async () => {
            // Basta que uma direção exista para o bloqueio ser detectado.
            // Para evitar erro na segunda chamada do .doc(), usamos mockReturnValue.
            mockDocFn.mockReturnValue(createMockDocRef(mockSnapshotExists));

            await expect(ensureNotBlocked(userId1, userId2)).rejects.toThrow('Ação não permitida devido a bloqueio.');
        });
    });
});

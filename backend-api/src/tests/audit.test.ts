import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService, AuditEventParams } from '../services/audit.service';

// Mocks do Firestore
const mockAdd = vi.fn().mockResolvedValue({ id: 'log-123' });
const mockCollection = vi.fn((_name: string) => ({ add: mockAdd }));

vi.mock('../firebase', () => ({
    db: {
        collection: (name: string) => mockCollection(name)
    }
}));

// Mock do FieldValue.serverTimestamp
vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'mock-timestamp'
    }
}));

// Mock do Logger para evitar ruído e testar chamadas
vi.mock('firebase-functions/logger', () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
}));

import * as logger from 'firebase-functions/logger';

describe('AuditService (Trilha de Auditoria)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve registrar um evento de auditoria no Firestore com os campos corretos', async () => {
        const params: AuditEventParams = {
            userId: 'user-123',
            action: 'USER_LOGIN',
            category: 'AUTH',
            ip: '127.0.0.1',
            userAgent: 'Vitest',
            requestId: 'req-abc'
        };

        await AuditService.logAuditEvent(params);

        // Verifica se chamou a coleção correta
        expect(mockCollection).toHaveBeenCalledWith('audit_logs');

        // Verifica os dados enviados para o Firestore
        expect(mockAdd).toHaveBeenCalledWith({
            ...params,
            timestamp: 'mock-timestamp'
        });

        // Verifica se logou no console (para visibilidade cloud)
        expect(logger.info).toHaveBeenCalledWith(
            '[AUDIT] AUTH:USER_LOGIN',
            expect.objectContaining({
                userId: 'user-123',
                requestId: 'req-abc'
            })
        );
    });

    it('deve incluir metadados e resourceId quando fornecidos', async () => {
        const params: AuditEventParams = {
            userId: 'admin-999',
            action: 'ROLE_CHANGED',
            category: 'USER',
            resourceId: 'target-user-456',
            metadata: { oldRole: 'user', newRole: 'admin' }
        };

        await AuditService.logAuditEvent(params);

        expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
            resourceId: 'target-user-456',
            metadata: { oldRole: 'user', newRole: 'admin' }
        }));
    });

    it('não deve lançar erro se a persistência no Firestore falhar', async () => {
        mockAdd.mockRejectedValueOnce(new Error('Firestore Down'));

        const params: AuditEventParams = {
            userId: 'user-123',
            action: 'USER_LOGIN',
            category: 'AUTH'
        };

        // A função não deve dar throw (o reject é capturado pelo .catch interno)
        await expect(AuditService.logAuditEvent(params)).resolves.not.toThrow();

        // No entanto, deve registrar o erro no logger
        // Como o .catch é assíncrono, precisamos esperar um pouco ou usar setImmediate
        await new Promise(resolve => setImmediate(resolve));

        expect(logger.error).toHaveBeenCalledWith(
            'Falha ao persistir log de auditoria no Firestore',
            expect.objectContaining({ error: 'Firestore Down' })
        );
    });
});

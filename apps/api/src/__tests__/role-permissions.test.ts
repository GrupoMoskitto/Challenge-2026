import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@prisma/client';

describe('Role Permissions & Access Control', () => {
  let findUniqueLeadSpy: any;
  let findManyUserSpy: any;
  let findManyAuditSpy: any;
  let updateLeadSpy: any;
  let createAuditLogSpy: any;

  beforeEach(() => {
    findUniqueLeadSpy = vi.spyOn(prisma.lead, 'findUnique');
    vi.spyOn(prisma.user, 'findUnique');
    findManyUserSpy = vi.spyOn(prisma.user, 'findMany');
    findManyAuditSpy = vi.spyOn(prisma.auditLog, 'findMany');
    updateLeadSpy = vi.spyOn(prisma.lead, 'update');
    createAuditLogSpy = vi.spyOn(prisma.auditLog, 'create');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries limited to ADMIN', () => {
    it('should block non-ADMIN from accessing users query', async () => {
      const context: Context = { user: { userId: '1', email: 'test@test.com', role: 'RECEPTION' } };
      await expect(resolvers.Query.users(null, {}, context)).rejects.toThrow('Acesso restrito a administradores');
    });

    it('should allow ADMIN to access users query', async () => {
      const context: Context = { user: { userId: '1', email: 'admin@test.com', role: 'ADMIN' } };
      findManyUserSpy.mockResolvedValue([{ id: '1', email: 'admin@test.com' }]);
      vi.spyOn(prisma.user, 'count').mockResolvedValue(1);
      const result = await resolvers.Query.users(null, { first: 20 }, context);
      expect(result.edges).toHaveLength(1);
    });

    it('should block non-ADMIN from accessing auditLogs query', async () => {
      const context: Context = { user: { userId: '1', email: 'test@test.com', role: 'SURGEON' } };
      await expect(resolvers.Query.auditLogs(null, {}, context)).rejects.toThrow('Acesso restrito a administradores');
    });

    it('should allow ADMIN to access auditLogs query', async () => {
      const context: Context = { user: { userId: '1', email: 'admin@test.com', role: 'ADMIN' } };
      findManyAuditSpy.mockResolvedValue([]);
      const result = await resolvers.Query.auditLogs(null, {}, context);
      expect(result).toBeDefined();
    });
  });

  describe('Mutations with Role Restrictions (RN03)', () => {
    it('should block RECEPTION from changing lead status to CONVERTED', async () => {
      findUniqueLeadSpy.mockResolvedValue({ id: 'lead-1', status: 'CONTACTED' });
      
      const context: Context = { user: { userId: 'rec-1', email: 'rec@test.com', role: 'RECEPTION' } };
      const input = { id: 'lead-1', status: LeadStatus.CONVERTED };

      await expect(resolvers.Mutation.updateLeadStatus(null, { input }, context))
        .rejects.toThrow('RN03_VIOLATION: Usuários do tipo RECEPTION não podem alterar status para CONVERTED.');
    });

    it('should block RECEPTION from changing lead status to LOST', async () => {
      findUniqueLeadSpy.mockResolvedValue({ id: 'lead-1', status: 'CONTACTED' });
      
      const context: Context = { user: { userId: 'rec-1', email: 'rec@test.com', role: 'RECEPTION' } };
      const input = { id: 'lead-1', status: LeadStatus.LOST };

      await expect(resolvers.Mutation.updateLeadStatus(null, { input }, context))
        .rejects.toThrow('RN03_VIOLATION: Usuários do tipo RECEPTION não podem alterar status para LOST.');
    });

    it('should allow CALL_CENTER to change lead status to CONVERTED', async () => {
      const mockLead = { id: 'lead-1', status: LeadStatus.CONTACTED };
      findUniqueLeadSpy.mockResolvedValue(mockLead);
      updateLeadSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.CONVERTED });
      createAuditLogSpy.mockResolvedValue({});

      const context: Context = { user: { userId: 'cc-1', email: 'cc@test.com', role: 'CALL_CENTER' } };
      const input = { id: 'lead-1', status: LeadStatus.CONVERTED };

      const result = await resolvers.Mutation.updateLeadStatus(null, { input }, context);
      expect(result.status).toBe(LeadStatus.CONVERTED);
      expect(updateLeadSpy).toHaveBeenCalled();
    });
  });
});

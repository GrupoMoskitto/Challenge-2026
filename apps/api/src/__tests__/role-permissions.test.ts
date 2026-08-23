// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@crmed/database';

describe('Role Permissions & Access Control', () => {
  let findUniqueLeadSpy: any;
  let findManyUserSpy: any;
  let findManyAuditSpy: any;
  let countAuditSpy: any;
  let updateLeadSpy: any;
  let updateAppointmentSpy: any;
  let createAuditLogSpy: any;

  beforeEach(() => {
    findUniqueLeadSpy = vi.spyOn(prisma.lead, 'findUnique');
    vi.spyOn(prisma.user, 'findUnique');
    findManyUserSpy = vi.spyOn(prisma.user, 'findMany');
    findManyAuditSpy = vi.spyOn(prisma.auditLog, 'findMany');
    countAuditSpy = vi.spyOn(prisma.auditLog, 'count');
    updateLeadSpy = vi.spyOn(prisma.lead, 'update');
    createAuditLogSpy = vi.spyOn(prisma.auditLog, 'create');
    updateAppointmentSpy = vi.spyOn(prisma.appointment, "update").mockResolvedValue({} as any);
    vi.spyOn(prisma.appointment, "findUnique").mockResolvedValue({ id: "appt-1", status: "SCHEDULED" } as any);
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
      countAuditSpy.mockResolvedValue(0);
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
    it('should block CALL_CENTER from changing appointment status to COMPLETED', async () => {
      vi.spyOn(prisma.appointment, 'findUnique').mockResolvedValue({ id: 'appt-1', status: 'SCHEDULED' } as any);
      const context: Context = { user: { userId: 'cc-1', email: 'cc@test.com', role: 'CALL_CENTER' } };
      const input = { id: 'appt-1', status: 'COMPLETED' };

      await expect(resolvers.Mutation.updateAppointmentStatus(null, { input }, context))
        .rejects.toThrow(/RN03_VIOLATION/);
    });

    it('should block SALES from changing appointment status to NO_SHOW', async () => {
      vi.spyOn(prisma.appointment, 'findUnique').mockResolvedValue({ id: 'appt-1', status: 'SCHEDULED' } as any);
      const context: Context = { user: { userId: 'sales-1', email: 'sales@test.com', role: 'SALES' } };
      const input = { id: 'appt-1', status: 'NO_SHOW' };

      await expect(resolvers.Mutation.updateAppointmentStatus(null, { input }, context))
        .rejects.toThrow(/RN03_VIOLATION/);
    });

    it('should allow ADMIN to change appointment status to COMPLETED', async () => {
      const mockAppt = { id: 'appt-1', status: 'SCHEDULED' };
      vi.spyOn(prisma.appointment, 'findUnique').mockResolvedValue(mockAppt as any);
      const updateSpy = vi.spyOn(prisma.appointment, 'update').mockResolvedValue({ ...mockAppt, status: 'COMPLETED' } as any);
      createAuditLogSpy.mockResolvedValue({});

      const context: Context = { user: { userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' } };
      const input = { id: 'appt-1', status: 'COMPLETED' };

      const result = await resolvers.Mutation.updateAppointmentStatus(null, { input }, context);
      expect(result.status).toBe('COMPLETED');
      expect(updateSpy).toHaveBeenCalled();
    });
  });
  
  describe('Data Masking (RN07 - LGPD Challenge)', () => {
    it('masks sensitive data (CPF, phone, address) for CALL_CENTER role', async () => {
      const callCenterCtx = { user: { userId: '3', role: 'CALL_CENTER', email: 'callcenter@test.com' } };
      
      const leadData = { cpf: '12345678909', phone: '11999999999' };
      const patientData = { address: 'Rua Secreta, 123' };
      
      // Test Lead resolvers
      const leadCpf = resolvers.Lead?.cpf?.(leadData as any, {}, callCenterCtx as any, {} as any);
      const leadPhone = resolvers.Lead?.phone?.(leadData as any, {}, callCenterCtx as any, {} as any);
      
      expect(leadCpf).toBe('***');
      expect(leadPhone).toBe('***');
      
      // Test Patient address resolver
      const patientAddress = resolvers.Patient?.address?.(patientData as any, {}, callCenterCtx as any, {} as any);
      expect(patientAddress).toBe('***');
      
      // Verify ADMIN can see the real data
      const adminCtx = { user: { userId: '1', role: 'ADMIN', email: 'admin@test.com' } };
      const unmaskedCpf = resolvers.Lead?.cpf?.(leadData as any, {}, adminCtx as any, {} as any);
      const unmaskedAddress = resolvers.Patient?.address?.(patientData as any, {}, adminCtx as any, {} as any);
      
      expect(unmaskedCpf).toBe('12345678909');
      expect(unmaskedAddress).toBe('Rua Secreta, 123');
    });
  });
});

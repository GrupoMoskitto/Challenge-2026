import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from './index';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@prisma/client';

describe('RN06 - Audit Logs (updateLeadStatus)', () => {
  let findUniqueSpy: any;
  let updateSpy: any;
  let createAuditLogSpy: any;

  beforeEach(() => {
    findUniqueSpy = vi.spyOn(prisma.lead, 'findUnique');
    updateSpy = vi.spyOn(prisma.lead, 'update');
    createAuditLogSpy = vi.spyOn(prisma.auditLog, 'create');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if the lead is not found', async () => {
    findUniqueSpy.mockResolvedValue(null);

    const input = { id: 'invalid-id', status: LeadStatus.CONTACTED };
    const context: Context = { user: { userId: 'admin', email: 'a@a.com', role: 'ADMIN' } };

    await expect(
      resolvers.Mutation.updateLeadStatus(null, { input }, context)
    ).rejects.toThrow('Lead não encontrado');
    
    expect(createAuditLogSpy).not.toHaveBeenCalled();
  });

  it('should update the lead status and create an audit log if user context exists', async () => {
    const mockLead = { id: 'lead-123', status: LeadStatus.NEW };
    findUniqueSpy.mockResolvedValue(mockLead as any);
    updateSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.CONTACTED } as any);
    createAuditLogSpy.mockResolvedValue({ id: 'audit-1' } as any);

    const input = { id: 'lead-123', status: LeadStatus.CONTACTED, reason: 'Test reason' };
    const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'CALL_CENTER' } };

    const result = await resolvers.Mutation.updateLeadStatus(null, { input }, context);

    expect(result.status).toBe(LeadStatus.CONTACTED);

    expect(createAuditLogSpy).toHaveBeenCalledWith({
      data: {
        entityType: 'Lead',
        entityId: 'lead-123',
        action: 'STATUS_CHANGE',
        oldValue: JSON.stringify(LeadStatus.NEW),
        newValue: JSON.stringify(LeadStatus.CONTACTED),
        reason: 'Test reason',
        userId: 'user-789',
      },
    });
  });

  it('should update the lead status but NOT create an audit log if user context is missing', async () => {
    const mockLead = { id: 'lead-123', status: LeadStatus.NEW };
    findUniqueSpy.mockResolvedValue(mockLead as any);
    updateSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.CONTACTED } as any);

    const input = { id: 'lead-123', status: LeadStatus.CONTACTED };
    const context: Context = {}; // No user

    const result = await resolvers.Mutation.updateLeadStatus(null, { input }, context);

    expect(result.status).toBe(LeadStatus.CONTACTED);
    // As per the current implementation, audit log is only created if `context.user?.userId` exists.
    expect(createAuditLogSpy).not.toHaveBeenCalled();
  });
});

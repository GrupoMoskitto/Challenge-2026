import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@prisma/client';

describe('RN06 - Audit Logs', () => {
  let createAuditLogSpy: any;
  let findUniqueLeadSpy: any;
  let updateLeadSpy: any;

  beforeEach(() => {
    createAuditLogSpy = vi.spyOn(prisma.auditLog, 'create');
    findUniqueLeadSpy = vi.spyOn(prisma.lead, 'findUnique');
    updateLeadSpy = vi.spyOn(prisma.lead, 'update');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create audit log when lead status is updated', async () => {
    const mockLead = { id: 'lead-1', status: LeadStatus.NEW };
    findUniqueLeadSpy.mockResolvedValue(mockLead);
    updateLeadSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.CONTACTED });
    createAuditLogSpy.mockResolvedValue({});

    const context: Context = { user: { userId: 'user-1', email: 'user@test.com', role: 'ADMIN' } };
    const input = { id: 'lead-1', status: LeadStatus.CONTACTED, reason: 'Cliente demonstrou interesse' };

    await resolvers.Mutation.updateLeadStatus(null, { input }, context);

    expect(createAuditLogSpy).toHaveBeenCalledWith({
      data: {
        entityType: 'Lead',
        entityId: 'lead-1',
        action: 'STATUS_CHANGE',
        userId: 'user-1',
        oldValue: LeadStatus.NEW,
        newValue: LeadStatus.CONTACTED,
        reason: 'Cliente demonstrou interesse',
      }
    });
  });

  it('should include userId and timestamp in audit log', async () => {
    const mockLead = { id: 'lead-2', status: LeadStatus.CONTACTED };
    findUniqueLeadSpy.mockResolvedValue(mockLead);
    updateLeadSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.QUALIFIED });
    createAuditLogSpy.mockResolvedValue({});

    const context: Context = { user: { userId: 'admin-1', email: 'admin@test.com', role: 'ADMIN' } };
    const input = { id: 'lead-2', status: LeadStatus.QUALIFIED };

    await resolvers.Mutation.updateLeadStatus(null, { input }, context);

    const callData = createAuditLogSpy.mock.calls[0][0].data;
    expect(callData.userId).toBe('admin-1');
    expect(callData.oldValue).toBe(LeadStatus.CONTACTED);
    expect(callData.newValue).toBe(LeadStatus.QUALIFIED);
  });
});

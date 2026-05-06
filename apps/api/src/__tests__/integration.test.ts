import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@crmed/database';

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Queries', () => {
    it('GetLeads: should return leads filtered by status', async () => {
      const mockLeads = [
        { id: '1', name: 'Lead 1', status: LeadStatus.NEW },
        { id: '2', name: 'Lead 2', status: LeadStatus.NEW }
      ];
      
      const findManySpy = vi.spyOn(prisma.lead, 'findMany').mockResolvedValue(mockLeads as never);
      vi.spyOn(prisma.lead, 'count').mockResolvedValue(2);

      const context: Context = { user: { userId: 'admin', email: 'test@test.com', role: 'ADMIN' } };
      
      const result = await resolvers.Query.leads(null, { status: LeadStatus.NEW }, context);
      
      expect(result.edges).toHaveLength(2);
      expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: LeadStatus.NEW })
      }));
    });

    it('GetSurgeons: should return active surgeons', async () => {
      const mockSurgeons = [{ id: 's1', name: 'Dr. Teste', isActive: true }];
      const findManySpy = vi.spyOn(prisma.surgeon, 'findMany').mockResolvedValue(mockSurgeons as never);
      
      const context: Context = { user: { userId: 'admin', email: 'test@test.com', role: 'ADMIN' } };
      const result = await resolvers.Query.surgeons(null, {}, context);
      
      expect(result).toHaveLength(1);
      expect(findManySpy).toHaveBeenCalled();
    });
  });

  describe('Mutations', () => {
    it('CreateLead: should fail due to uniqueness constraint (RN01)', async () => {
      const mockExisting = { id: 'ext-1' };
      vi.spyOn(prisma.lead, 'findFirst').mockResolvedValue(mockExisting as never);
      
      const context: Context = { user: { userId: 'admin', email: 'a@a.com', role: 'ADMIN' } };
      const input = { name: 'João', email: 'existente@test.com', phone: '1199999999' };

      await expect(resolvers.Mutation.createLead(null, { input }, context))
        .rejects.toThrow('RN01_VIOLATION:');
    });

    it('UpdateLeadStatus: should fail for unauthorized role (RN03)', async () => {
      const mockLead = { id: 'l1', status: LeadStatus.NEW };
      vi.spyOn(prisma.lead, 'findUnique').mockResolvedValue(mockLead as never);
      
      // SALES role trying to update to LOST might not be allowed in the strict RN03 setup
      // Let's assume RECEPTION trying to update to CONVERTED
      const context: Context = { user: { userId: 'user', email: 'u@test.com', role: 'RECEPTION' } };
      const input = { id: 'l1', status: LeadStatus.CONVERTED };

      // The project setup throws an error if not allowed
      await expect(resolvers.Mutation.updateLeadStatus(null, { input }, context))
        .rejects.toThrow(/RN03_VIOLATION|Sem permissão/);
    });
  });
});

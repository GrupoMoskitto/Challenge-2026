// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma, ensureExplicitTimezone } from '@crmed/database';

describe('Appointment Concurrency and Timezone', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Item 1 - Timezone Contract', () => {
    it('accepts valid UTC Z format', () => {
      expect(() => ensureExplicitTimezone('2026-04-01T10:00:00Z')).not.toThrow();
    });

    it('accepts explicit offset format', () => {
      expect(() => ensureExplicitTimezone('2026-04-01T10:00:00-03:00')).not.toThrow();
      expect(() => ensureExplicitTimezone('2026-04-01T10:00:00+00:00')).not.toThrow();
    });

    it('rejects ambiguous format without timezone', () => {
      expect(() => ensureExplicitTimezone('2026-04-01T10:00:00'))
        .toThrow('Formato de data ambíguo');
    });
  });

  describe('Item 2 - Race Condition (Concurrency)', () => {
    it('prevents Phantom Reads using Serializable transaction isolation', async () => {
      // Mock the transaction to simulate that BOTH findFirst calls resolve to null (concurrent check)
      // but one of the inserts fails with a serialization error or constraint violation.
      // In a true database environment, the first transaction commits, and the second one 
      // fails due to Serializable read/write conflict, throwing P2034.
      
      const ctx: Context = { user: { userId: '1', email: 'admin@test.com', role: 'ADMIN' } };
      const input = { patientId: 'p1', surgeonId: 's1', procedure: 'Cons', scheduledAt: '2027-04-01T14:00:00Z' };

      vi.spyOn(prisma.surgeon, 'findUnique').mockResolvedValue({ id: 's1', appointmentDuration: 30 } as any);
      
      // Simulate transaction behavior with a lock flag
      let isInserted = false;
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any, options: any) => {
        expect(options.isolationLevel).toBe('Serializable');
        return cb({
          appointment: {
            findFirst: vi.fn().mockImplementation(async () => {
              if (isInserted) return { id: 'overlap' };
              return null;
            }),
            create: vi.fn().mockImplementation(async () => {
              if (isInserted) throw new Error('Transaction serialization error P2034');
              isInserted = true;
              return { id: 'a1', status: 'SCHEDULED' };
            }),
          },
          auditLog: { create: vi.fn() },
        });
      });

      // Fire both simultaneously using Promise.all
      // Note: Because we use the same mocked cb state above, the second transaction might fail on findFirst if the first finished its create first.
      // We will explicitly test that they don't both succeed.
      const results = await Promise.allSettled([
        resolvers.Mutation.createAppointment(null, { input }, ctx),
        resolvers.Mutation.createAppointment(null, { input }, ctx),
      ]);

      const successes = results.filter(r => r.status === 'fulfilled');
      const rejections = results.filter(r => r.status === 'rejected');
      if (rejections.length > 0) {
        console.error(rejections.map((r: any) => r.reason));
      }

      expect(successes.length).toBe(1);
      expect(rejections.length).toBe(1);
    });
  });
});

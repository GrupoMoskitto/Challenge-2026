import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma } from '@crmed/database';
import { checkSurgeonAvailability } from '../lib/availability';

// Mock availability to decouple tests slightly or we can just test the e2e logic with mocks
vi.mock('../lib/availability', () => ({
  checkSurgeonAvailability: vi.fn(),
}));

describe('createAppointment rules (RN08 and Overlap)', () => {
  let findFirstSurgeonSpy: any;
  let transactionSpy: any;

  beforeEach(() => {
    findFirstSurgeonSpy = vi.spyOn(prisma.surgeon, 'findFirst');
    transactionSpy = vi.spyOn(prisma, '$transaction');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const getFutureDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0); // next day 14:00
    return d.toISOString();
  };

  it('bypasses RN08 for ADMIN', async () => {
    findFirstSurgeonSpy.mockResolvedValue({ id: 's1', appointmentDuration: 30 } as any);
    transactionSpy.mockImplementation(async (cb: any) => {
      return cb({
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'a1', status: 'SCHEDULED' }),
        },
        auditLog: {
          create: vi.fn(),
        }
      });
    });

    const ctx: Context = { user: { userId: '1', email: 'admin@test.com', role: 'ADMIN' } };
    const input = { patientId: 'p1', surgeonId: 's1', procedure: 'Cons', scheduledAt: getFutureDate() };

    await resolvers.Mutation.createAppointment(null, { input }, ctx);
    
    // checkSurgeonAvailability should not be called since ADMIN bypasses RN08
    expect(checkSurgeonAvailability).not.toHaveBeenCalled();
  });

  it('enforces RN08 for CALL_CENTER and blocks if unavailable', async () => {
    findFirstSurgeonSpy.mockResolvedValue({ id: 's1', appointmentDuration: 30 } as any);
    (checkSurgeonAvailability as any).mockReturnValue(false); // mock out of hours

    const ctx: Context = { user: { userId: '2', email: 'cc@test.com', role: 'CALL_CENTER' } };
    const input = { patientId: 'p1', surgeonId: 's1', procedure: 'Cons', scheduledAt: getFutureDate() };

    await expect(resolvers.Mutation.createAppointment(null, { input }, ctx))
      .rejects.toThrow('Horário fora do expediente ou indisponível para este médico.');
    
    expect(checkSurgeonAvailability).toHaveBeenCalled();
  });

  it('blocks if overlap exists in transaction (ALTA 1)', async () => {
    findFirstSurgeonSpy.mockResolvedValue({ id: 's1', appointmentDuration: 30 } as any);
    (checkSurgeonAvailability as any).mockReturnValue(true); // available

    transactionSpy.mockImplementation(async (cb: any) => {
      return cb({
        appointment: {
          findFirst: vi.fn().mockResolvedValue({ id: 'a2' }), // mock overlap
        }
      });
    });

    const ctx: Context = { user: { userId: '2', email: 'cc@test.com', role: 'CALL_CENTER' } };
    const input = { patientId: 'p1', surgeonId: 's1', procedure: 'Cons', scheduledAt: getFutureDate() };

    await expect(resolvers.Mutation.createAppointment(null, { input }, ctx))
      .rejects.toThrow('Conflito de horário: o médico já possui consulta agendada neste período.');
  });
});

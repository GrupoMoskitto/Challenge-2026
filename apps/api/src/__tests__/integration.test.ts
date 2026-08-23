import { describe, it, expect } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { prisma } from '@crmed/database';

describe('Real Database Integration Tests', () => {
  it('prevents Phantom Reads using Serializable transaction isolation (Real DB)', async () => {
    // 1. Create a patient and surgeon to test against
    const patient = await prisma.patient.findFirst();
    const surgeon = await prisma.surgeon.findFirst();
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    
    expect(patient).toBeDefined();
    expect(surgeon).toBeDefined();
    expect(user).toBeDefined();

    const ctx: Context = { user: { userId: user!.id, email: user!.email, role: 'ADMIN' } };
    const input = { 
      patientId: Buffer.from(patient!.id).toString('base64url'), 
      surgeonId: Buffer.from(surgeon!.id).toString('base64url'), 
      procedure: 'Consulta Real', 
      scheduledAt: '2028-01-01T10:00:00Z' 
    };

    // 2. Fire two createAppointment mutations perfectly in parallel
    const results = await Promise.allSettled([
      resolvers.Mutation.createAppointment(null, { input }, ctx),
      resolvers.Mutation.createAppointment(null, { input }, ctx),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const rejections = results.filter(r => r.status === 'rejected');

    if (successes.length !== 1) {
       console.error("Rejections:", rejections.map((r: any) => r.reason));
    }

    // Due to Serializable isolation, exactly one should succeed, and one should fail (P2034)
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);
    
    // Make sure the rejected one failed with Prisma's serialization error
    const rejectionReason = (rejections[0] as PromiseRejectedResult).reason;
    expect(rejectionReason.message).toMatch(/transaction/i);
    
    // Clean up
    const successResult = (successes[0] as PromiseFulfilledResult<any>).value;
    await prisma.appointment.delete({ where: { id: successResult.id } });
  });
});

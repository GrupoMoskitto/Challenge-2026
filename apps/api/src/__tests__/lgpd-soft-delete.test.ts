// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@crmed/database';
import { resolvers } from '../graphql/resolvers';

describe('LGPD Soft-Delete Tests', () => {
  it('filters out soft-deleted leads', async () => {
    const deletedLead = await prisma.lead.create({
      data: {
        name: 'Deleted Lead',
        email: 'del@del.com',
        phone: '12345678901',
        cpf: '00000000001',
        source: 'TEST',
        deletedAt: new Date(),
      }
    });

    const res = await resolvers.Query.lead(null, { id: deletedLead.id }, { user: { role: 'ADMIN' } });
    expect(res).toBeNull();

    const allLeads = await resolvers.Query.leads(null, {}, { user: { role: 'ADMIN' } });
    const found = allLeads.edges.find((e: any) => e.node.id === deletedLead.id);
    expect(found).toBeUndefined();

    await prisma.lead.delete({ where: { id: deletedLead.id } });
  });

  it('filters out soft-deleted patients', async () => {
    const lead = await prisma.lead.create({
      data: { name: 'Active Lead for Del Patient', phone: '2222', cpf: '00000000002', email: '2@2.com', source: 'TEST' }
    });

    const deletedPatient = await prisma.patient.create({
      data: {
        leadId: lead.id,
        deletedAt: new Date(),
      }
    });

    const res = await resolvers.Query.patient(null, { id: deletedPatient.id }, { user: { role: 'ADMIN' } });
    expect(res).toBeNull();

    const leadPatientRes = await resolvers.Lead.patient({ id: lead.id });
    expect(leadPatientRes).toBeNull();

    await prisma.patient.delete({ where: { id: deletedPatient.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });

  it('filters out soft-deleted surgeons', async () => {
    const deletedSurgeon = await prisma.surgeon.create({
      data: {
        name: 'Deleted Surgeon',
        email: 'del_surg@del.com',
        phone: '12345',
        crm: '12345-DEL',
        specialty: 'Test',
        deletedAt: new Date(),
      }
    });

    const res = await resolvers.Query.surgeon(null, { id: deletedSurgeon.id }, { user: { role: 'ADMIN' } });
    expect(res).toBeNull();

    const allSurgeons = await resolvers.Query.surgeons(null, {}, { user: { role: 'ADMIN' } });
    const found = allSurgeons.find((s: any) => s.id === deletedSurgeon.id);
    expect(found).toBeUndefined();

    await prisma.surgeon.delete({ where: { id: deletedSurgeon.id } });
  });
});

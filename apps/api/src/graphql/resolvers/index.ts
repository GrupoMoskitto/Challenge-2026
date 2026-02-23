import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus } from '@prisma/client';
import { DateTimeScalar, IDScalar } from '../scalars';

const encodeBase64 = (id: string): string => {
  return Buffer.from(id).toString('base64url');
};

export const resolvers = {
  ID: IDScalar,
  DateTime: DateTimeScalar,
  Query: {
    leads: async (_: unknown, { status, first, after }: { status?: LeadStatus; first?: number; after?: string }) => {
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;
      
      const leads = await prisma.lead.findMany({
        where: status ? { status } : undefined,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: 'desc' },
      });

      const hasNextPage = leads.length > limit;
      const edges = leads.slice(0, limit).map((lead) => ({
        node: lead,
        cursor: encodeBase64(lead.id),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: await prisma.lead.count({ where: status ? { status } : undefined }),
      };
    },
    lead: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.lead.findUnique({ where: { id: decodedId } });
    },
    leadByCpf: async (_: unknown, { cpf }: { cpf: string }) => {
      return prisma.lead.findUnique({ where: { cpf } });
    },
    patients: async () => {
      return prisma.patient.findMany({
        include: { lead: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    patient: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.patient.findUnique({
        where: { id: decodedId },
        include: { lead: true },
      });
    },
    appointments: async (_: unknown, { status }: { status?: AppointmentStatus }) => {
      return prisma.appointment.findMany({
        where: status ? { status } : undefined,
        include: { patient: true, surgeon: true },
        orderBy: { scheduledAt: 'asc' },
      });
    },
    appointment: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.appointment.findUnique({
        where: { id: decodedId },
        include: { patient: true, surgeon: true },
      });
    },
    surgeons: async () => {
      return prisma.surgeon.findMany({
        where: { isActive: true },
        include: { availability: true },
      });
    },
    surgeon: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.surgeon.findUnique({
        where: { id: decodedId },
        include: { availability: true },
      });
    },
    users: async () => {
      return prisma.user.findMany({
        where: { isActive: true },
      });
    },
    user: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.user.findUnique({ where: { id: decodedId } });
    },
    auditLogs: async (_: unknown, { entityType, entityId }: { entityType?: string; entityId?: string }) => {
      return prisma.auditLog.findMany({
        where: {
          entityType: entityType || undefined,
          entityId: entityId || undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  },
  Mutation: {
    createLead: async (_: unknown, { input }: { input: {
      name: string;
      email: string;
      phone: string;
      cpf: string;
      source: string;
    }}) => {
      await checkUniqueness({ cpf: input.cpf, email: input.email, phone: input.phone });

      return prisma.lead.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          cpf: input.cpf,
          source: input.source,
          status: LeadStatus.NEW,
        },
      });
    },
    updateLeadStatus: async (_: unknown, { input }: { input: {
      id: string;
      status: LeadStatus;
      reason?: string;
    }}) => {
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const currentLead = await prisma.lead.findUnique({ where: { id: decodedId } });
      if (!currentLead) throw new Error('Lead não encontrado');

      const updatedLead = await prisma.lead.update({
        where: { id: decodedId },
        data: { status: input.status },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Lead',
          entityId: decodedId,
          action: 'STATUS_CHANGE',
          oldValue: JSON.stringify(currentLead.status),
          newValue: JSON.stringify(input.status),
          reason: input.reason || 'Alteração de status',
        },
      });

      return updatedLead;
    },
    createPatient: async (_: unknown, { input }: { input: {
      leadId: string;
      dateOfBirth: string;
      medicalRecord?: string;
    }}) => {
      const decodedLeadId = Buffer.from(input.leadId, 'base64url').toString('utf-8');
      
      if (input.medicalRecord) {
        const existing = await prisma.patient.findUnique({
          where: { medicalRecord: input.medicalRecord },
        });
        if (existing) throw new Error('RN01_VIOLATION: Prontuário já cadastrado');
      }

      return prisma.patient.create({
        data: {
          leadId: decodedLeadId,
          dateOfBirth: new Date(input.dateOfBirth),
          medicalRecord: input.medicalRecord,
        },
        include: { lead: true },
      });
    },
    createAppointment: async (_: unknown, { input }: { input: {
      patientId: string;
      surgeonId: string;
      procedure: string;
      scheduledAt: string;
      notes?: string;
    }}) => {
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      const decodedSurgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      
      return prisma.appointment.create({
        data: {
          patientId: decodedPatientId,
          surgeonId: decodedSurgeonId,
          procedure: input.procedure,
          scheduledAt: new Date(input.scheduledAt),
          notes: input.notes,
        },
        include: { patient: true, surgeon: true },
      });
    },
    updateAppointmentStatus: async (_: unknown, { input }: { input: {
      id: string;
      status: AppointmentStatus;
      reason?: string;
    }}) => {
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const current = await prisma.appointment.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Agendamento não encontrado');

      const updated = await prisma.appointment.update({
        where: { id: decodedId },
        data: { status: input.status },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: decodedId,
          action: 'STATUS_CHANGE',
          oldValue: JSON.stringify(current.status),
          newValue: JSON.stringify(input.status),
          reason: input.reason || 'Alteração de status',
          appointmentId: decodedId,
        },
      });

      return updated;
    },
    createSurgeon: async (_: unknown, { input }: { input: {
      name: string;
      specialty: string;
      crm: string;
      email: string;
      phone: string;
    }}) => {
      const existing = await prisma.surgeon.findFirst({
        where: { OR: [{ crm: input.crm }, { email: input.email }] },
      });
      if (existing) {
        throw new Error('RN01_VIOLATION: CRM ou e-mail já cadastrado');
      }

      return prisma.surgeon.create({ data: input });
    },
    createUser: async (_: unknown, { input }: { input: {
      email: string;
      name: string;
      role: string;
    }}) => {
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new Error('RN01_VIOLATION: E-mail já cadastrado');
      }

      return prisma.user.create({ data: input });
    },
  },
};

import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus } from '@prisma/client';

export const resolvers = {
  Query: {
    leads: async (_: unknown, { status }: { status?: LeadStatus }) => {
      return prisma.lead.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
      });
    },

    lead: async (_: unknown, { id }: { id: string }) => {
      return prisma.lead.findUnique({ where: { id } });
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
      return prisma.patient.findUnique({
        where: { id },
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
      return prisma.appointment.findUnique({
        where: { id },
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
      return prisma.surgeon.findUnique({
        where: { id },
        include: { availability: true },
      });
    },

    users: async () => {
      return prisma.user.findMany({
        where: { isActive: true },
      });
    },

    user: async (_: unknown, { id }: { id: string }) => {
      return prisma.user.findUnique({ where: { id } });
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
      const currentLead = await prisma.lead.findUnique({ where: { id: input.id } });
      if (!currentLead) throw new Error('Lead não encontrado');

      const updatedLead = await prisma.lead.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Lead',
          entityId: input.id,
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
      if (input.medicalRecord) {
        const existing = await prisma.patient.findUnique({
          where: { medicalRecord: input.medicalRecord },
        });
        if (existing) throw new Error('RN01_VIOLATION: Prontuário já cadastrado');
      }

      return prisma.patient.create({
        data: {
          leadId: input.leadId,
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
      return prisma.appointment.create({
        data: {
          patientId: input.patientId,
          surgeonId: input.surgeonId,
          procedure: input.procedure,
          scheduledAt: new Date(input.scheduledAt),
          notes: input.notes,
          status: AppointmentStatus.SCHEDULED,
        },
        include: { patient: true, surgeon: true },
      });
    },

    updateAppointmentStatus: async (_: unknown, { input }: { input: {
      id: string;
      status: AppointmentStatus;
      reason?: string;
    }}) => {
      const current = await prisma.appointment.findUnique({ where: { id: input.id } });
      if (!current) throw new Error('Agendamento não encontrado');

      const updated = await prisma.appointment.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: input.id,
          action: 'STATUS_CHANGE',
          oldValue: JSON.stringify(current.status),
          newValue: JSON.stringify(input.status),
          reason: input.reason || 'Alteração de status',
          appointmentId: input.id,
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

      return prisma.surgeon.create({
        data: input,
      });
    },

    createUser: async (_: unknown, { input }: { input: {
      email: string;
      name: string;
      role: string;
    }}) => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new Error('RN01_VIOLATION: E-mail já cadastrado');
      }

      return prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role as any,
        },
      });
    },
  },

  Lead: {
    patient: async (parent: { id: string }) => {
      return prisma.patient.findUnique({ where: { leadId: parent.id } });
    },
    appointments: async (parent: { id: string }) => {
      return prisma.appointment.findMany({ where: { patientId: parent.id } });
    },
  },

  Patient: {
    lead: async (parent: { leadId: string }) => {
      return prisma.lead.findUnique({ where: { id: parent.leadId } });
    },
  },

  Appointment: {
    patient: async (parent: { patientId: string }) => {
      return prisma.lead.findUnique({ where: { id: parent.patientId } });
    },
    surgeon: async (parent: { surgeonId: string }) => {
      return prisma.surgeon.findUnique({ where: { id: parent.surgeonId } });
    },
    auditLogs: async (parent: { id: string }) => {
      return prisma.auditLog.findMany({
        where: { appointmentId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
    notifications: async (parent: { id: string }) => {
      return prisma.notification.findMany({
        where: { appointmentId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Surgeon: {
    appointments: async (parent: { id: string }) => {
      return prisma.appointment.findMany({ where: { surgeonId: parent.id } });
    },
    availability: async (parent: { id: string }) => {
      return prisma.availabilitySlot.findMany({ where: { surgeonId: parent.id } });
    },
  },

  User: {
    auditLogs: async (parent: { id: string }) => {
      return prisma.auditLog.findMany({
        where: { userId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
  },
};

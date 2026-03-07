import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus } from '@prisma/client';
import { DateTimeScalar, IDScalar } from '../scalars';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } from '../../auth';

const encodeBase64 = (id: string): string => {
  return Buffer.from(id).toString('base64url');
};

export interface Context {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const resolvers = {
  ID: IDScalar,
  DateTime: DateTimeScalar,
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) return null;
      return prisma.user.findUnique({ where: { id: context.user.userId } });
    },
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
      return prisma.lead.findUnique({ 
        where: { id: decodedId },
        include: { contacts: true },
      });
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
    appointmentsByDate: async (_: unknown, { date }: { date: string }) => {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      
      return prisma.appointment.findMany({
        where: {
          scheduledAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: { patient: true, surgeon: true },
        orderBy: { scheduledAt: 'asc' },
      });
    },
    appointmentsBySurgeon: async (_: unknown, { surgeonId, startDate, endDate }: { surgeonId: string; startDate?: string; endDate?: string }) => {
      const decodedId = Buffer.from(surgeonId, 'base64url').toString('utf-8');
      return prisma.appointment.findMany({
        where: {
          surgeonId: decodedId,
          scheduledAt: startDate && endDate ? {
            gte: new Date(startDate),
            lte: new Date(endDate),
          } : undefined,
        },
        include: { patient: true, surgeon: true },
        orderBy: { scheduledAt: 'asc' },
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
    availableSurgeons: async (_: unknown, { date }: { date: string }) => {
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();
      
      const surgeonsWithSlots = await prisma.surgeon.findMany({
        where: { isActive: true },
        include: {
          availability: {
            where: {
              dayOfWeek,
              isActive: true,
            },
          },
        },
      });
      
      return surgeonsWithSlots.filter(s => s.availability.length > 0);
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
    contactsByLead: async (_: unknown, { leadId }: { leadId: string }) => {
      const decodedId = Buffer.from(leadId, 'base64url').toString('utf-8');
      return prisma.contact.findMany({
        where: { leadId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    documentsByPatient: async (_: unknown, { patientId }: { patientId: string }) => {
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.document.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    postOpsByPatient: async (_: unknown, { patientId }: { patientId: string }) => {
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.postOp.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'asc' },
      });
    },
    upcomingPostOps: async (_: unknown, { days }: { days?: number }) => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + (days || 7));
      
      return prisma.postOp.findMany({
        where: {
          date: {
            gte: new Date(),
            lte: targetDate,
          },
          status: 'SCHEDULED',
        },
        include: { patient: { include: { lead: true } } },
        orderBy: { date: 'asc' },
      });
    },
    messageTemplates: async () => {
      return prisma.messageTemplate.findMany({
        orderBy: { name: 'asc' },
      });
    },
    messageTemplate: async (_: unknown, { id }: { id: string }) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.messageTemplate.findUnique({ where: { id: decodedId } });
    },
  },
  Mutation: {
    login: async (_: unknown, { input }: { input: { email: string; password: string } }) => {
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });
      
      if (!user) {
        throw new Error('Credenciais inválidas');
      }
      
      const isValid = await comparePassword(input.password, user.password);
      if (!isValid) {
        throw new Error('Credenciais inválidas');
      }
      
      if (!user.isActive) {
        throw new Error('Usuário inativo');
      }
      
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      
      const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      
      return { token, refreshToken, user };
    },
    refreshToken: async (_: unknown, { token }: { token: string }) => {
      const decoded = verifyRefreshToken(token);
      if (!decoded) {
        throw new Error('Refresh token inválido');
      }
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      
      if (!user || !user.isActive) {
        throw new Error('Usuário não encontrado ou inativo');
      }
      
      const newToken = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      
      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      
      return { token: newToken, refreshToken: newRefreshToken };
    },
    register: async (_: unknown, { input }: { input: { email: string; name: string; role: string; password: string } }) => {
      const hashedPassword = await hashPassword(input.password);
      
      return prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role as any,
          password: hashedPassword,
        },
      });
    },
    createLead: async (_: unknown, { input }: { input: {
      name: string;
      email: string;
      phone: string;
      cpf: string;
      source: string;
      origin?: string;
      procedure?: string;
      preferredDoctor?: string;
      whatsappActive?: boolean;
      notes?: string;
    }}) => {
      await checkUniqueness({ cpf: input.cpf, email: input.email, phone: input.phone });

      return prisma.lead.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          cpf: input.cpf,
          source: input.source,
          origin: input.origin,
          procedure: input.procedure,
          preferredDoctor: input.preferredDoctor,
          whatsappActive: input.whatsappActive || false,
          notes: input.notes,
          status: LeadStatus.NEW,
        },
      });
    },
    updateLeadStatus: async (_: unknown, { input }: { input: {
      id: string;
      status: LeadStatus;
      reason?: string;
    }}, context: Context) => {
      // ID já vem como texto puro do frontend
      const leadId = input.id;
      console.log('=== updateLeadStatus called ===');
      console.log('input:', JSON.stringify(input));
      console.log('leadId:', leadId);
      
      try {
        const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
        console.log('currentLead:', currentLead);
        if (!currentLead) {
          throw new Error('Lead não encontrado');
        }

        const updatedLead = await prisma.lead.update({
          where: { id: leadId },
          data: { status: input.status },
        });

        if (context.user?.userId) {
          await prisma.auditLog.create({
            data: {
              entityType: 'Lead',
              entityId: leadId,
              action: 'STATUS_CHANGE',
              oldValue: JSON.stringify(currentLead.status),
              newValue: JSON.stringify(input.status),
              reason: input.reason || 'Alteração de status',
              userId: context.user.userId,
            },
          });
        }

        return updatedLead;
      } catch (error) {
        console.error('updateLeadStatus error:', error);
        throw error;
      }
    },
    updateLead: async (_: unknown, { input }: { input: {
      id: string;
      name?: string;
      email?: string;
      phone?: string;
      cpf?: string;
      source?: string;
      origin?: string;
      procedure?: string;
      preferredDoctor?: string;
      whatsappActive?: boolean;
      notes?: string;
      status?: LeadStatus;
    }}, context: Context) => {
      const leadId = input.id;
      const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!currentLead) throw new Error('Lead não encontrado');

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.cpf !== undefined) updateData.cpf = input.cpf;
      if (input.source !== undefined) updateData.source = input.source;
      if (input.origin !== undefined) updateData.origin = input.origin;
      if (input.procedure !== undefined) updateData.procedure = input.procedure;
      if (input.preferredDoctor !== undefined) updateData.preferredDoctor = input.preferredDoctor;
      if (input.whatsappActive !== undefined) updateData.whatsappActive = input.whatsappActive;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.status !== undefined) updateData.status = input.status;

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });

      return updatedLead;
    },
    deleteLead: async (_: unknown, { id }: { id: string }, context: Context) => {
      const existingLead = await prisma.lead.findUnique({ where: { id } });
      if (!existingLead) throw new Error('Lead não encontrado');

      await prisma.lead.delete({ where: { id } });

      return { success: true, message: 'Lead excluído com sucesso' };
    },
    createPatient: async (_: unknown, { input }: { input: {
      leadId: string;
      dateOfBirth: string;
      medicalRecord?: string;
      address?: string;
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
          address: input.address,
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
    }}, context: Context) => {
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      const decodedSurgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      
      const appointment = await prisma.appointment.create({
        data: {
          patientId: decodedPatientId,
          surgeonId: decodedSurgeonId,
          procedure: input.procedure,
          scheduledAt: new Date(input.scheduledAt),
          notes: input.notes,
        },
        include: { patient: true, surgeon: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: appointment.id,
          action: 'CREATED',
          newValue: JSON.stringify({ procedure: input.procedure, scheduledAt: input.scheduledAt }),
          reason: 'Novo agendamento criado',
          userId: context.user?.userId,
          appointmentId: appointment.id,
        },
      });

      return appointment;
    },
    updateAppointmentStatus: async (_: unknown, { input }: { input: {
      id: string;
      status: AppointmentStatus;
      reason?: string;
    }}, context: Context) => {
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
          userId: context.user?.userId,
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
      password: string;
    }}) => {
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new Error('RN01_VIOLATION: E-mail já cadastrado');
      }

      const hashedPassword = await hashPassword(input.password);

      return prisma.user.create({ 
        data: {
          email: input.email,
          name: input.name,
          role: input.role as any,
          password: hashedPassword,
        } 
      });
    },
    createContact: async (_: unknown, { input }: { input: {
      leadId: string;
      date: string;
      type: string;
      direction: string;
      status: string;
      message: string;
    }}) => {
      const decodedLeadId = Buffer.from(input.leadId, 'base64url').toString('utf-8');
      
      return prisma.contact.create({
        data: {
          leadId: decodedLeadId,
          date: new Date(input.date),
          type: input.type as any,
          direction: input.direction as any,
          status: input.status as any,
          message: input.message,
        },
      });
    },
    createDocument: async (_: unknown, { input }: { input: {
      patientId: string;
      name: string;
      type: string;
      date: string;
      status?: string;
    }}) => {
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      
      return prisma.document.create({
        data: {
          patientId: decodedPatientId,
          name: input.name,
          type: input.type as any,
          date: new Date(input.date),
          status: input.status as any || 'PENDING',
        },
      });
    },
    createPostOp: async (_: unknown, { input }: { input: {
      patientId: string;
      date: string;
      type: string;
      description: string;
      status?: string;
    }}) => {
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      
      return prisma.postOp.create({
        data: {
          patientId: decodedPatientId,
          date: new Date(input.date),
          type: input.type as any,
          description: input.description,
          status: input.status as any || 'SCHEDULED',
        },
      });
    },
    createMessageTemplate: async (_: unknown, { input }: { input: {
      name: string;
      channel: string;
      content: string;
      triggerDays?: number;
    }}) => {
      return prisma.messageTemplate.create({
        data: {
          name: input.name,
          channel: input.channel as any,
          content: input.content,
          triggerDays: input.triggerDays || 0,
        },
      });
    },
  },
};

import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus } from '@prisma/client';
import { DateTimeScalar, IDScalar } from '../scalars';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyRefreshToken } from '../../auth';
import { dispatchLeadWelcome, dispatchLeadFollowup } from '../../services/whatsappQueue';

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
    leads: async (_: unknown, { status, first, after, search }: { status?: LeadStatus; first?: number; after?: string; search?: string }, context: Context) => {
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;
      
      const whereClause: any = status ? { status } : {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      if (context.user?.role === 'SURGEON') {
        const surgeon = await prisma.surgeon.findFirst({ where: { email: context.user.email } });
        if (surgeon) {
          whereClause.preferredDoctor = surgeon.id;
        } else {
          // If the user is a surgeon but has no surgeon profile, they see no leads
          return {
            edges: [],
            pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
            totalCount: 0,
          };
        }
      }

      const where = Object.keys(whereClause).length > 0 ? whereClause : undefined;

      const leads = await prisma.lead.findMany({
        where,
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
        totalCount: await prisma.lead.count({ where }),
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
    patients: async (_: unknown, { first, after, where }: { 
      first?: number; 
      after?: string; 
      where?: { 
        status?: LeadStatus; 
        search?: string; 
        surgeonId?: string;
        createdFrom?: string;
        createdTo?: string;
      } 
    }, context: Context) => {
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;

      const whereClause: any = {};

      if (where?.status) {
        whereClause.lead = { ...whereClause.lead, status: where.status };
      }

      if (where?.search) {
        whereClause.OR = [
          { lead: { name: { contains: where.search, mode: 'insensitive' } } },
          { lead: { cpf: { contains: where.search, mode: 'insensitive' } } },
          { lead: { phone: { contains: where.search, mode: 'insensitive' } } },
        ];
      }

      if (where?.surgeonId) {
        const decodedSurgeonId = Buffer.from(where.surgeonId, 'base64url').toString('utf-8');
        whereClause.appointments = {
          some: { surgeonId: decodedSurgeonId },
        };
      }

      if (where?.createdFrom || where?.createdTo) {
        whereClause.createdAt = {};
        if (where.createdFrom) whereClause.createdAt.gte = new Date(where.createdFrom);
        if (where.createdTo) whereClause.createdAt.lte = new Date(where.createdTo);
      }

      const whereFinal = Object.keys(whereClause).length > 0 ? whereClause : undefined;

      const patients = await prisma.patient.findMany({
        where: whereFinal,
        include: { lead: true },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: 'desc' },
      });

      const hasNextPage = patients.length > limit;
      const edges = patients.slice(0, limit).map((patient) => ({
        node: patient,
        cursor: encodeBase64(patient.id),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: await prisma.patient.count({ where: whereFinal }),
      };
    },
    patient: async (_: unknown, { id }: { id: string }) => {
      let decodedId = id;
      try {
        const decoded = Buffer.from(id, 'base64url').toString('utf-8');
        if (decoded && decoded.match(/^[a-zA-Z0-9_-]+$/)) {
          decodedId = decoded;
        }
      } catch {
        decodedId = id;
      }
      return prisma.patient.findUnique({
        where: { id: decodedId },
        include: { 
          lead: { include: { contacts: true } }, 
          documents: { orderBy: { date: 'desc' } }, 
          postOps: { orderBy: { date: 'desc' } },
          auditLogs: { orderBy: { createdAt: 'desc' } },
        },
      });
    },
    appointments: async (_: unknown, { status }: { status?: AppointmentStatus }, context: Context) => {
      const whereClause: any = status ? { status } : {};
      
      if (context.user?.role === 'SURGEON') {
        const surgeon = await prisma.surgeon.findFirst({ where: { email: context.user.email } });
        if (surgeon) {
          whereClause.surgeonId = surgeon.id;
        } else {
          return [];
        }
      }

      const where = Object.keys(whereClause).length > 0 ? whereClause : undefined;

      return prisma.appointment.findMany({
        where,
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
    appointmentsByDate: async (_: unknown, { date }: { date: any }) => {
      const dateObj = typeof date === 'string' ? new Date(date) : (date as Date);
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const day = dateObj.getUTCDate();
      
      const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
      
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
    users: async (_: unknown, __: unknown, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      return prisma.user.findMany({
        orderBy: { name: 'asc' },
      });
    },
    user: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.user.findUnique({ where: { id: decodedId } });
    },
    auditLogs: async (_: unknown, { entityType, entityId }: { entityType?: string; entityId?: string }, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
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
    evolutionApiInstances: async (_: unknown, __: unknown, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '***REMOVED***';

      try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: EVOLUTION_API_KEY },
        });
        
        if (!response.ok) throw new Error('Failed to fetch from Evolution API');
        
        const rawData = await response.json() as any;
        const data = Array.isArray(rawData) ? rawData : (rawData?.instances || []);
        
        return data.map((inst: any) => {
          const name = inst.instance?.instanceName || inst.name || inst.instanceName || 'Unknown';
          const state = inst.instance?.state || inst.connectionStatus || inst.status || inst.state || 'disconnected';
          return {
            connected: state === 'open' || state === 'CONNECTED',
            instanceName: name,
            state: state,
          };
        });
      } catch (_error) {
        return [];
      }
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

      const newLead = await prisma.lead.create({
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

      // Dispatch welcome message
      await dispatchLeadWelcome(newLead.id, newLead.name, newLead.phone, newLead.procedure || undefined);

      return newLead;
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

        // RN03: Restrição de Hierarquia para Mudanças de Status Críticos
        const criticalStatuses: LeadStatus[] = [LeadStatus.CONVERTED, LeadStatus.LOST];
        if (
          criticalStatuses.includes(input.status) &&
          context.user &&
          context.user.role === 'RECEPTION'
        ) {
          throw new Error('RN03_VIOLATION: Usuários do tipo RECEPTION não podem converter ou perder leads.');
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

        // Trigger Follow up logic if changed to CONTACTED
        if (input.status === LeadStatus.CONTACTED && currentLead.status === LeadStatus.NEW) {
          await dispatchLeadFollowup(updatedLead.id, updatedLead.name, updatedLead.phone, updatedLead.procedure || undefined, 7);
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

      await checkUniqueness({
        cpf: input.cpf,
        email: input.email,
        phone: input.phone,
        excludeId: leadId,
      });

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
      
      if (input.status !== undefined) {
        // RN03: Restrição de Hierarquia para Mudanças de Status Críticos
        const criticalStatuses: LeadStatus[] = [LeadStatus.CONVERTED, LeadStatus.LOST];
        if (
          criticalStatuses.includes(input.status) &&
          context.user &&
          context.user.role === 'RECEPTION'
        ) {
          throw new Error('RN03_VIOLATION: Usuários do tipo RECEPTION não podem converter ou perder leads.');
        }
        updateData.status = input.status;
      }

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });

      if (input.status === LeadStatus.CONTACTED && currentLead.status === LeadStatus.NEW) {
        await dispatchLeadFollowup(updatedLead.id, updatedLead.name, updatedLead.phone, updatedLead.procedure || undefined, 7);
      }

      return updatedLead;
    },
    deleteUser: async (_: unknown, { id }: { id: string }, _context: Context) => {
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
    }}, context: Context) => {
      const decodedLeadId = Buffer.from(input.leadId, 'base64url').toString('utf-8');
      
      const lead = await prisma.lead.findUnique({ where: { id: decodedLeadId } });
      if (!lead) throw new Error('Lead não encontrado');
      
      await checkUniqueness({
        cpf: lead.cpf,
        email: lead.email,
        phone: lead.phone,
        excludeId: decodedLeadId,
      });

      if (input.medicalRecord) {
        const existing = await prisma.patient.findUnique({
          where: { medicalRecord: input.medicalRecord },
        });
        if (existing) throw new Error('RN01_VIOLATION: Prontuário já cadastrado');
      }

      const patient = await prisma.patient.create({
        data: {
          leadId: decodedLeadId,
          dateOfBirth: new Date(input.dateOfBirth),
          medicalRecord: input.medicalRecord,
          address: input.address,
        },
        include: { lead: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Patient',
          entityId: patient.id,
          action: 'CREATED',
          newValue: JSON.stringify({
            dateOfBirth: input.dateOfBirth,
            medicalRecord: input.medicalRecord,
            address: input.address,
          }),
          reason: 'Paciente criado a partir de lead',
          userId: context.user?.userId,
        },
      });

      return patient;
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
    updateAppointment: async (_: unknown, { input }: { input: {
      id: string;
      patientId?: string;
      surgeonId?: string;
      procedure?: string;
      scheduledAt?: string;
      notes?: string;
    }}, context: Context) => {
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const current = await prisma.appointment.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Agendamento não encontrado');

      const data: any = {};
      if (input.patientId) data.patientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      if (input.surgeonId) data.surgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      if (input.procedure) data.procedure = input.procedure;
      if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt);
      if (input.notes !== undefined) data.notes = input.notes;

      const updated = await prisma.appointment.update({
        where: { id: decodedId },
        data,
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: decodedId,
          action: 'UPDATED',
          oldValue: JSON.stringify({ procedure: current.procedure, scheduledAt: current.scheduledAt }),
          newValue: JSON.stringify({ procedure: updated.procedure, scheduledAt: updated.scheduledAt }),
          reason: 'Agendamento atualizado',
          userId: context.user?.userId,
          appointmentId: decodedId,
        },
      });

      return updated;
    },
    deleteAppointment: async (_: unknown, { id }: { id: string }, context: Context) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const current = await prisma.appointment.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Agendamento não encontrado');

      await prisma.appointment.delete({ where: { id: decodedId } });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: decodedId,
          action: 'DELETED',
          oldValue: JSON.stringify({ procedure: current.procedure, scheduledAt: current.scheduledAt }),
          reason: 'Agendamento excluído',
          userId: context.user?.userId,
        },
      });

      return { success: true, message: 'Agendamento excluído com sucesso' };
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
    }}, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
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
    toggleUserStatus: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const user = await prisma.user.findUnique({ where: { id: decodedId } });
      if (!user) throw new Error('Usuário não encontrado');
      
      const newStatus = !user.isActive;

      await prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: JSON.stringify({ isActive: user.isActive }),
          newValue: JSON.stringify({ isActive: newStatus }),
          reason: 'Ativação/Desativação de usuário',
          userId: (context.user as any).userId,
        },
      });

      return prisma.user.update({
        where: { id: decodedId },
        data: { isActive: newStatus },
      });
    },
    updateProfile: async (_: unknown, { input }: { input: { name?: string; password?: string } }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.password) {
        updateData.password = await hashPassword(input.password);
      }
      
      return prisma.user.update({
        where: { id: context.user.userId },
        data: updateData,
      });
    },
    updatePatient: async (_: unknown, { input }: { input: { id: string; dateOfBirth?: string; medicalRecord?: string; address?: string; reason?: string } }, context: Context) => {
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      
      const current = await prisma.patient.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Paciente não encontrado');
      
      if (input.medicalRecord) {
        const existing = await prisma.patient.findUnique({ where: { medicalRecord: input.medicalRecord } });
        if (existing && existing.id !== decodedId) {
          throw new Error('RN01_VIOLATION: Prontuário já cadastrado por outro paciente');
        }
      }
      
      const updateData: any = {};
      const changes: any = {};
      if (input.dateOfBirth !== undefined) {
        updateData.dateOfBirth = new Date(input.dateOfBirth);
        changes.dateOfBirth = { from: current.dateOfBirth, to: new Date(input.dateOfBirth) };
      }
      if (input.medicalRecord !== undefined) {
        updateData.medicalRecord = input.medicalRecord;
        changes.medicalRecord = { from: current.medicalRecord, to: input.medicalRecord };
      }
      if (input.address !== undefined) {
        updateData.address = input.address;
        changes.address = { from: current.address, to: input.address };
      }
      
      const updated = await prisma.patient.update({
        where: { id: decodedId },
        data: updateData,
        include: { lead: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Patient',
          entityId: decodedId,
          action: 'UPDATED',
          oldValue: JSON.stringify({
            dateOfBirth: current.dateOfBirth,
            medicalRecord: current.medicalRecord,
            address: current.address,
          }),
          newValue: JSON.stringify(changes),
          reason: input.reason || 'Atualização de dados do paciente',
          userId: context.user?.userId,
        },
      });
      
      return updated;
    },
    updateDocumentStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: Context) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const current = await prisma.document.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Documento não encontrado');

      await prisma.auditLog.create({
        data: {
          entityType: 'Document',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: JSON.stringify({ status: current.status }),
          newValue: JSON.stringify({ status }),
          reason: 'Atualização do status do documento',
          userId: context.user?.userId,
        },
      });
      return prisma.document.update({
        where: { id: decodedId },
        data: { status: status as any },
      });
    },
    updatePostOpStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: Context) => {
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const current = await prisma.postOp.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Pós-operatório não encontrado');

      await prisma.auditLog.create({
        data: {
          entityType: 'PostOp',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: JSON.stringify({ status: current.status }),
          newValue: JSON.stringify({ status }),
          reason: 'Atualização do status do retorno pós-operatório',
          userId: context.user?.userId,
        },
      });
      return prisma.postOp.update({
        where: { id: decodedId },
        data: { status: status as any },
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
    }}, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      return prisma.messageTemplate.create({
        data: {
          name: input.name,
          channel: input.channel as any,
          content: input.content,
          triggerDays: input.triggerDays || 0,
        },
      });
    },
    updateMessageTemplate: async (_: unknown, { input }: { input: {
      id: string;
      name?: string;
      channel?: string;
      content?: string;
      triggerDays?: number;
    }}, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const existing = await prisma.messageTemplate.findUnique({ where: { id: input.id } });
      if (!existing) throw new Error('Template não encontrado');

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.channel !== undefined) updateData.channel = input.channel;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.triggerDays !== undefined) updateData.triggerDays = input.triggerDays;

      return prisma.messageTemplate.update({
        where: { id: input.id },
        data: updateData,
      });
    },
    deleteMessageTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const existing = await prisma.messageTemplate.findUnique({ where: { id } });
      if (!existing) throw new Error('Template não encontrado');

      await prisma.messageTemplate.delete({ where: { id } });
      return { success: true, message: 'Template excluído com sucesso' };
    },
    testMessageTemplate: async (_: unknown, { templateId, instanceName }: { templateId: string; instanceName: string }, context: Context) => {
      if (context.user?.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const { dispatchTemplateTest } = await import('../../services/whatsappQueue');
      await dispatchTemplateTest(templateId, instanceName, context.user.userId);
      return true;
    },
  },
};

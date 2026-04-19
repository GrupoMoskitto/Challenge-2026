import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus, UserRole, ContactType, ContactDirection, ContactStatus, DocumentType, DocumentStatus, PostOpType, PostOpStatus, MessageChannel, BudgetStatus, ComplaintStatus } from '@prisma/client';
import { format, subDays } from 'date-fns';
import { DateTimeScalar, IDScalar } from '../scalars';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyRefreshToken, checkRateLimit, resetRateLimit, COOKIE_OPTIONS, isTokenRevoked, revokeUserTokens, clearTokenRevocation } from '../../auth';
import { dispatchLeadWelcome, dispatchLeadFollowup } from '../../services/whatsappQueue';
import { assertAuthenticated, assertRole, enforceStatusChange, validateEnum } from '../../config/rbac';
import { logger } from '../../config/logger';

const encodeBase64 = (id: string): string => {
  return Buffer.from(id).toString('base64url');
};

export interface Context {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  res?: import('express').Response;
}

const surgeonCache = new WeakMap<Context, string | null>();

function getSurgeonFromContext(context: Context): string | null {
  return surgeonCache.get(context) ?? null;
}

function setSurgeonInContext(context: Context, surgeonId: string | null): void {
  surgeonCache.set(context, surgeonId);
}

export const resolvers = {
  ID: IDScalar,
  DateTime: DateTimeScalar,
  Patient: {
    lead: async (parent: { leadId: string }) => {
      return prisma.lead.findUnique({ where: { id: parent.leadId } });
    },
    name: async (parent: { leadId: string }) => {
      const lead = await prisma.lead.findUnique({ where: { id: parent.leadId } });
      return lead?.name ?? null;
    },
    email: async (parent: { leadId: string }) => {
      const lead = await prisma.lead.findUnique({ where: { id: parent.leadId } });
      return lead?.email ?? null;
    },
    phone: async (parent: { leadId: string }) => {
      const lead = await prisma.lead.findUnique({ where: { id: parent.leadId } });
      return lead?.phone ?? null;
    },
    bmi: async (parent: { weight: number | null; height: number | null }) => {
      if (!parent.weight || !parent.height || parent.height <= 0) {
        return null;
      }
      const heightInMeters = parent.height / 100;
      const bmi = parent.weight / (heightInMeters * heightInMeters);
      return Math.round(bmi * 10) / 10;
    },
  },
  Lead: {
    contacts: async (parent: { id: string }) => {
      const contacts = await prisma.contact.findMany({
        where: { leadId: parent.id },
      });
      return contacts.length > 0 ? contacts : [];
    },
    patient: async (parent: { id: string }) => {
      return prisma.patient.findUnique({
        where: { leadId: parent.id },
      });
    },
    appointments: async (parent: { id: string }) => {
      const patient = await prisma.patient.findUnique({
        where: { leadId: parent.id },
      });
      if (!patient) return [];
      
      return prisma.appointment.findMany({
        where: { patientId: patient.id },
        orderBy: { scheduledAt: 'desc' },
      });
    },
  },
  Appointment: {
    patient: async (parent: { patientId: string }) => {
      return prisma.patient.findUnique({ 
        where: { id: parent.patientId },
        include: { lead: true },
      });
    },
  },
  Budget: {
    patient: async (parent: { patientId: string }) => {
      return prisma.patient.findUnique({ where: { id: parent.patientId } });
    },
    surgeon: async (parent: { surgeonId: string }) => {
      return prisma.surgeon.findUnique({ where: { id: parent.surgeonId } });
    },
    followUps: async (parent: { id: string }) => {
      return prisma.budgetFollowUp.findMany({
        where: { budgetId: parent.id },
        orderBy: { date: 'desc' },
      });
    },
  },
  Complaint: {
    patient: async (parent: { patientId: string }) => {
      return prisma.patient.findUnique({ where: { id: parent.patientId } });
    },
    treatments: async (parent: { id: string }) => {
      return prisma.treatment.findMany({
        where: { complaintId: parent.id },
        orderBy: { date: 'asc' },
      });
    },
  },
  Surgeon: {
    extraAvailability: async (parent: { id: string }) => {
      return prisma.extraAvailabilitySlot.findMany({
        where: { surgeonId: parent.id },
        orderBy: { date: 'asc' },
      });
    },
    blocks: async (parent: { id: string }) => {
      return prisma.scheduleBlock.findMany({
        where: { surgeonId: parent.id },
        orderBy: { startDate: 'desc' },
      });
    },
  },
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) return null;
      return prisma.user.findUnique({ where: { id: context.user.userId } });
    },
    leads: async (_: unknown, { status, first, after, search }: { status?: LeadStatus; first?: number; after?: string; search?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;
      
      const whereClause: any = status ? { status } : {};

      if (search) {
        const sanitizedSearch = search.trim().substring(0, 100); // Limit search length
        whereClause.OR = [
          { name: { contains: sanitizedSearch, mode: 'insensitive' } },
          { cpf: { contains: sanitizedSearch, mode: 'insensitive' } },
          { phone: { contains: sanitizedSearch, mode: 'insensitive' } },
          { email: { contains: sanitizedSearch, mode: 'insensitive' } },
        ];
      }
      
      if (context.user?.role === 'SURGEON') {
        let surgeonId = getSurgeonFromContext(context);
        if (!surgeonId) {
          const surgeon = await prisma.surgeon.findFirst({ where: { email: context.user.email } });
          surgeonId = surgeon?.id ?? null;
          setSurgeonInContext(context, surgeonId);
        }
        if (surgeonId) {
          whereClause.preferredDoctor = surgeonId;
        } else {
          return {
            edges: [],
            pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
            totalCount: 0,
          };
        }
      }

      const where = Object.keys(whereClause).length > 0 ? whereClause : undefined;

      const [leads, totalCount] = await Promise.all([
        prisma.lead.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lead.count({ where }),
      ]);

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
        totalCount,
      };
    },
    lead: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.lead.findUnique({ 
        where: { id: decodedId },
        include: { contacts: true },
      });
    },
    leadByCpf: async (_: unknown, { cpf }: { cpf: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;

      const whereClause: any = {};

      if (where?.status) {
        whereClause.lead = { ...whereClause.lead, status: where.status };
      }

      if (where?.search) {
        const sanitizedSearch = where.search.trim().substring(0, 100);
        whereClause.OR = [
          { lead: { name: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { lead: { cpf: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { lead: { phone: { contains: sanitizedSearch, mode: 'insensitive' } } },
        ];
      }

      if (where?.surgeonId) {
        const decodedSurgeonId = Buffer.from(where.surgeonId, 'base64url').toString('utf-8');
        whereClause.appointments = {
          some: { surgeonId: decodedSurgeonId },
        };
      }

      if (where?.createdFrom || where?.createdTo) {
        whereClause.createdAt = {} as any;
        if (where.createdFrom) whereClause.createdAt.gte = new Date(where.createdFrom);
        if (where.createdTo) whereClause.createdAt.lte = new Date(where.createdTo);
      }

      const whereFinal = Object.keys(whereClause).length > 0 ? whereClause : undefined;

      const [patients, totalCount] = await Promise.all([
        prisma.patient.findMany({
          where: whereFinal,
          include: { lead: true },
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.patient.count({ where: whereFinal }),
      ]);

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
        totalCount,
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const whereClause: any = status ? { status } : {};
      
      if (context.user?.role === 'SURGEON') {
        let surgeonId = getSurgeonFromContext(context);
        if (!surgeonId) {
          const surgeon = await prisma.surgeon.findFirst({ where: { email: context.user.email } });
          surgeonId = surgeon?.id ?? null;
          setSurgeonInContext(context, surgeonId);
        }
        if (surgeonId) {
          whereClause.surgeonId = surgeonId;
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
    appointment: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      // ID is already decoded by ID scalar
      return prisma.appointment.findUnique({
        where: { id },
        include: { patient: true, surgeon: true },
      });
    },
    appointmentsByDate: async (_: unknown, { date }: { date: string | Date }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const dateObj = typeof date === 'string' ? new Date(date) : (date as Date);
      
      // Use UTC consistently to avoid timezone issues
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const day = dateObj.getUTCDate();
      
      const startOfDay = Date.UTC(year, month, day, 0, 0, 0, 0);
      const endOfDay = Date.UTC(year, month, day, 23, 59, 59, 999);
      
      const appointments = await prisma.appointment.findMany({
        where: {
          scheduledAt: {
            gte: new Date(startOfDay),
            lte: new Date(endOfDay),
          },
        },
        include: { patient: true, surgeon: true },
        orderBy: { scheduledAt: 'asc' },
      });
      return appointments;
    },
    appointmentsBySurgeon: async (_: unknown, { surgeonId, startDate, endDate }: { surgeonId: string; startDate?: string; endDate?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
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
    surgeons: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      return prisma.surgeon.findMany({
        where: { isActive: true },
        include: { availability: true, extraAvailability: true, blocks: true },
      });
    },
    surgeon: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.surgeon.findUnique({
        where: { id: decodedId },
        include: { availability: true, extraAvailability: true, blocks: true },
      });
    },
    availableSurgeons: async (_: unknown, { date }: { date: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
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
    users: async (_: unknown, { first, after }: { first?: number; after?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const limit = first || 20;
      const cursor = after ? Buffer.from(after, 'base64url').toString('utf-8') : undefined;
      
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { name: 'asc' },
        }),
        prisma.user.count(),
      ]);
      
      const hasNextPage = users.length > limit;
      const edges = users.slice(0, limit).map((user) => ({
        node: user,
        cursor: encodeBase64(user.id),
      }));
      
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },
    user: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.user.findUnique({ where: { id: decodedId } });
    },
    auditLogs: async (_: unknown, { entityType, entityId }: { entityType?: string; entityId?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      return prisma.auditLog.findMany({
        where: {
          entityType: entityType || undefined,
          entityId: entityId || undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
    },
    contactsByLead: async (_: unknown, { leadId }: { leadId: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedId = Buffer.from(leadId, 'base64url').toString('utf-8');
      return prisma.contact.findMany({
        where: { leadId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    documentsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.document.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    postOpsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.postOp.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'asc' },
      });
    },
    upcomingPostOps: async (_: unknown, { days }: { days?: number }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
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
    notifications: async (_: unknown, { status, first }: { status?: string; first?: number }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const whereClause: any = {};
      if (status) whereClause.status = status;
      
      return prisma.notification.findMany({
        where: whereClause,
        take: first || 20,
        include: { appointment: { include: { patient: { include: { lead: true } }, surgeon: true } } },
        orderBy: { createdAt: 'desc' },
      });
    },
    unreadNotificationsCount: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) return 0;
      
      return prisma.notification.count({
        where: { status: 'PENDING' },
      });
    },
    messageTemplates: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      return prisma.messageTemplate.findMany({
        orderBy: { name: 'asc' },
      });
    },
    messageTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.messageTemplate.findUnique({ where: { id: decodedId } });
    },
    evolutionApiInstances: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY environment variable is required');

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
    testPhoneLastDigits: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') return null;
      
      const testPhone = process.env.DEV_ALLOWED_PHONE;
      if (!testPhone) return null;
      
      // Return only last 4 digits for security
      const cleanedPhone = testPhone.replace(/[^0-9]/g, '');
      return cleanedPhone.slice(-4);
    },
    budgets: async (_: unknown, { status, surgeonId }: { status?: BudgetStatus; surgeonId?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (surgeonId) {
        const decodedId = Buffer.from(surgeonId, 'base64url').toString('utf-8');
        where.surgeonId = decodedId;
      }
      
      return prisma.budget.findMany({
        where,
        include: { patient: { include: { lead: true } }, surgeon: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    budget: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.budget.findUnique({
        where: { id: decodedId },
        include: { patient: { include: { lead: true } }, surgeon: true, followUps: true },
      });
    },
    budgetsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.budget.findMany({
        where: { patientId: decodedId },
        include: { surgeon: true, followUps: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    complaints: async (_: unknown, { status, area }: { status?: ComplaintStatus; area?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (area) where.area = area;
      
      return prisma.complaint.findMany({
        where,
        include: { patient: { include: { lead: true } }, treatments: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    complaint: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      return prisma.complaint.findUnique({
        where: { id: decodedId },
        include: { patient: { include: { lead: true } }, treatments: true },
      });
    },
    complaintsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(patientId, 'base64url').toString('utf-8');
      return prisma.complaint.findMany({
        where: { patientId: decodedId },
        include: { treatments: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    dashboardStats: async (_: unknown, { startDate, endDate }: { startDate?: string; endDate?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      
      const [totalLeads, totalPatients, appointments, leadsByStatus, leadsBySource] = await Promise.all([
        prisma.lead.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.patient.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.appointment.findMany({
          where: { scheduledAt: { gte: start, lte: end } },
          include: { surgeon: true },
        }),
        prisma.lead.groupBy({
          by: ['status'],
          _count: true,
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.lead.groupBy({
          by: ['source'],
          _count: true,
          where: { createdAt: { gte: start, lte: end } },
        }),
      ]);
      
      const appointmentsByStatus = appointments.reduce((acc, appt) => {
        const status = appt.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const appointmentsByStatusList = Object.entries(appointmentsByStatus).map(([status, count]) => ({
        status,
        count,
      }));
      
      const leadsByStatusList = leadsByStatus.map(item => ({
        status: item.status,
        count: item._count,
      }));
      
      const leadsBySourceList = leadsBySource.map(item => ({
        source: item.source,
        count: item._count,
      }));
      
      const convertedLeads = leadsByStatus.find(l => l.status === LeadStatus.CONVERTED)?._count || 0;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
      
      const surgeonMap = new Map<string, { name: string; total: number; converted: number }>();
      for (const appt of appointments) {
        const existing = surgeonMap.get(appt.surgeonId) || { name: appt.surgeon.name, total: 0, converted: 0 };
        existing.total += 1;
        if (appt.status === AppointmentStatus.COMPLETED) {
          existing.converted += 1;
        }
        surgeonMap.set(appt.surgeonId, existing);
      }
      
      const surgeonConversion = Array.from(surgeonMap.entries()).map(([surgeonId, data]) => ({
        surgeonId,
        surgeonName: data.name,
        totalAppointments: data.total,
        totalConverted: data.converted,
        conversionRate: data.total > 0 ? (data.converted / data.total) * 100 : 0,
      }));
      
      return {
        totalLeads,
        totalPatients,
        totalAppointments: appointments.length,
        conversionRate,
        appointmentsByStatus: appointmentsByStatusList,
        leadsBySource: leadsBySourceList,
        leadsByStatus: leadsByStatusList,
        surgeonConversion,
      };
    },
    performanceMetrics: async (_: unknown, { startDate, endDate }: { startDate?: string; endDate?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
      const end = endDate ? new Date(endDate) : new Date();
      
      const [leads, contacts, appointments] = await Promise.all([
        prisma.lead.findMany({
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.contact.findMany({
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.appointment.findMany({
          where: { scheduledAt: { gte: start, lte: end } },
          include: { patient: { include: { lead: true } } },
        }),
      ]);

      const totalContacts = contacts.length;
      const totalConversions = leads.filter(l => l.status === LeadStatus.CONVERTED).length;
      
      const leadsWithContact = new Set<string>();
      contacts.forEach(c => leadsWithContact.add(c.leadId));
      const responseRate = leads.length > 0 ? (leadsWithContact.size / leads.length) * 100 : 0;

      let totalFirstContactTime = 0;
      let firstContactCount = 0;
      for (const lead of leads) {
        const leadContacts = contacts.filter(c => c.leadId === lead.id);
        if (leadContacts.length > 0) {
          const firstContact = leadContacts[0];
          const leadCreated = new Date(lead.createdAt).getTime();
          const contactCreated = new Date(firstContact.createdAt).getTime();
          if (contactCreated >= leadCreated) {
            totalFirstContactTime += (contactCreated - leadCreated) / (1000 * 60 * 60);
            firstContactCount++;
          }
        }
      }
      const avgFirstContactTime = firstContactCount > 0 ? totalFirstContactTime / firstContactCount : null;

      let totalConversionTime = 0;
      let conversionCount = 0;
      const convertedLeads = leads.filter(l => l.status === LeadStatus.CONVERTED);
      for (const lead of convertedLeads) {
        const leadCreated = new Date(lead.createdAt).getTime();
        const convertedAt = new Date(lead.updatedAt).getTime();
        totalConversionTime += (convertedAt - leadCreated) / (1000 * 60 * 60 * 24);
        conversionCount++;
      }
      const avgConversionTime = conversionCount > 0 ? totalConversionTime / conversionCount : null;

      let totalSchedulingTime = 0;
      let schedulingCount = 0;
      for (const appt of appointments) {
        if (appt.patient?.lead) {
          const leadCreated = new Date(appt.patient.lead.createdAt).getTime();
          const apptScheduled = new Date(appt.scheduledAt).getTime();
          if (apptScheduled >= leadCreated) {
            totalSchedulingTime += (apptScheduled - leadCreated) / (1000 * 60 * 60 * 24);
            schedulingCount++;
          }
        }
      }
      const avgSchedulingTime = schedulingCount > 0 ? totalSchedulingTime / schedulingCount : null;

      const dateMap = new Map<string, { count: number; converted: number }>();
      leads.forEach(lead => {
        const dateKey = format(new Date(lead.createdAt), 'yyyy-MM-dd');
        const existing = dateMap.get(dateKey) || { count: 0, converted: 0 };
        existing.count++;
        if (lead.status === LeadStatus.CONVERTED) {
          existing.converted++;
        }
        dateMap.set(dateKey, existing);
      });
      const leadsByDay = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, count: data.count, converted: data.converted }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const statusCounts = leads.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const conversionFunnel = [
        { status: 'Novo', count: statusCounts[LeadStatus.NEW] || 0 },
        { status: 'Contatado', count: statusCounts[LeadStatus.CONTACTED] || 0 },
        { status: 'Qualificado', count: statusCounts[LeadStatus.QUALIFIED] || 0 },
        { status: 'Convertido', count: statusCounts[LeadStatus.CONVERTED] || 0 },
        { status: 'Perdido', count: statusCounts[LeadStatus.LOST] || 0 },
      ];

      return {
        avgFirstContactTime,
        avgConversionTime,
        avgSchedulingTime,
        responseRate,
        totalContacts,
        totalConversions,
        leadsByDay,
        conversionFunnel,
      };
    },
  },
  Mutation: {
    login: async (_: unknown, { input }: { input: { email: string; password: string } }, context: Context) => {
      // Rate limiting - use IP from context or default
      const clientIp = (context as Record<string, unknown>)?.ip as string || 'default-ip';
      if (!checkRateLimit(clientIp)) {
        throw new Error('Muitas tentativas de login. Tente novamente em 15 minutos.');
      }
      
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

      // Check if user tokens were revoked (admin deactivated then reactivated)
      const revoked = await isTokenRevoked(user.id);
      if (revoked) {
        // Clear revocation on successful login
        await clearTokenRevocation(user.id);
      }
      
      // Reset rate limit on successful login
      resetRateLimit(clientIp);
      
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = generateToken(payload);
      const refreshTokenValue = generateRefreshToken(payload);

      // Set HTTP-Only cookies if response object is available
      if (context.res) {
        context.res.cookie('access_token', token, COOKIE_OPTIONS.ACCESS_TOKEN);
        context.res.cookie('refresh_token', refreshTokenValue, COOKIE_OPTIONS.REFRESH_TOKEN);
      }
      
      // Return tokens in body for backward compatibility with existing clients
      return { token, refreshToken: refreshTokenValue, user };
    },
    refreshToken: async (_: unknown, { token }: { token: string }, context: Context) => {
      const decoded = verifyRefreshToken(token);
      if (!decoded) {
        throw new Error('Refresh token inválido');
      }

      // Check token blacklist
      const revoked = await isTokenRevoked(decoded.userId);
      if (revoked) {
        throw new Error('Sessão revogada. Faça login novamente.');
      }
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      
      if (!user || !user.isActive) {
        throw new Error('Usuário não encontrado ou inativo');
      }
      
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newToken = generateToken(payload);
      const newRefreshToken = generateRefreshToken(payload);

      // Set HTTP-Only cookies if response available
      if (context.res) {
        context.res.cookie('access_token', newToken, COOKIE_OPTIONS.ACCESS_TOKEN);
        context.res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);
      }
      
      return { token: newToken, refreshToken: newRefreshToken };
    },
    // register mutation removed for security - use createUser (ADMIN only) instead
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
    }}, context: Context) => {
      assertAuthenticated(context);
      await checkUniqueness({ cpf: input.cpf, email: input.email, phone: input.phone });

      // Validate preferredDoctor if provided
      if (input.preferredDoctor) {
        const surgeon = await prisma.surgeon.findUnique({ where: { id: input.preferredDoctor } });
        if (!surgeon) throw new Error('Médico não encontrado');
      }

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
      // Auth + RBAC check first — no anonymous status changes
      assertAuthenticated(context);

      // Server-side enum validation — never trust client input
      validateEnum(input.status, LeadStatus, 'LeadStatus');
      
      const leadId = input.id;
      
      const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!currentLead) {
        throw new Error('Lead não encontrado');
      }

      // RN03 + RN06: Centralized status change enforcement
      await enforceStatusChange({
        context,
        entityType: 'Lead',
        entityId: leadId,
        oldStatus: currentLead.status,
        newStatus: input.status,
        blockedRoles: ['RECEPTION'],
        criticalStatuses: ['CONVERTED', 'LOST'],
        reason: input.reason,
      });

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: { status: input.status },
      });

      // Note: AuditLog is already created by enforceStatusChange above (RN06)

      // Trigger Follow up logic if changed to CONTACTED
      if (input.status === LeadStatus.CONTACTED && currentLead.status === LeadStatus.NEW) {
        await dispatchLeadFollowup(updatedLead.id, updatedLead.name, updatedLead.phone, updatedLead.procedure || undefined, 7);
      }

      return updatedLead;
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const leadId = input.id;
      const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!currentLead) throw new Error('Lead não encontrado');

      await checkUniqueness({
        cpf: input.cpf,
        email: input.email,
        phone: input.phone,
        excludeId: leadId,
      });

      const updateData: Record<string, unknown> = {};
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
      
      const oldStatus = currentLead.status;
      let statusChanged = false;
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
        if (input.status !== oldStatus) {
          statusChanged = true;
        }
        updateData.status = input.status;
      }

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: updateData,
      });

      // RN06: Criar AuditLog para mudança de status
      if (statusChanged && context.user?.userId) {
        await prisma.auditLog.create({
          data: {
            entityType: 'Lead',
            entityId: leadId,
            action: 'STATUS_CHANGE',
            oldValue: oldStatus,
            newValue: input.status,
            reason: 'Atualização de status via updateLead',
            userId: context.user.userId,
          },
        });
      }

      if (input.status === LeadStatus.CONTACTED && currentLead.status === LeadStatus.NEW) {
        await dispatchLeadFollowup(updatedLead.id, updatedLead.name, updatedLead.phone, updatedLead.procedure || undefined, 7);
      }

      return updatedLead;
    },
    deleteLead: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      // RN03: Apenas ADMIN ou SALES podem deletar leads
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES') {
        throw new Error('RN03_VIOLATION: Apenas administradores e vendedores podem excluir leads');
      }
      
      const existingLead = await prisma.lead.findUnique({ where: { id } });
      if (!existingLead) throw new Error('Lead não encontrado');

      // Check if there's a patient associated with this lead
      const patient = await prisma.patient.findUnique({ where: { leadId: id } });
      
      // Check if there are appointments associated with this patient
      if (patient) {
        const appointmentCount = await prisma.appointment.count({
          where: { patientId: patient.id },
        });
        if (appointmentCount > 0) {
          throw new Error('Não é possível excluir lead com agendamentos associados');
        }
      }

      // Delete patient first (if exists), then lead
      if (patient) {
        await prisma.patient.delete({ where: { id: patient.id } });
      }
      await prisma.lead.delete({ where: { id } });

      return { success: true, message: 'Lead excluído com sucesso' };
    },
    exportLeads: async (_: unknown, { format }: { format?: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const leads = await prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      const headers = ['Nome', 'Email', 'Telefone', 'CPF', 'Source', 'Origin', 'Procedimento', 'Status', 'Data Criação'];
      const rows = leads.map(lead => [
        lead.name,
        lead.email,
        lead.phone,
        lead.cpf,
        lead.source,
        lead.origin || '',
        lead.procedure || '',
        lead.status,
        new Date(lead.createdAt).toLocaleDateString('pt-BR'),
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n');
      
      const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');
      return `data:text/csv;base64,${base64}`;
    },
    importLeads: async (_: unknown, { csvContent }: { csvContent: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES') {
        throw new Error('Acesso restrito a administradores e vendedores');
      }
      
      try {
        const decoded = Buffer.from(csvContent, 'base64').toString('utf-8');
        const lines = decoded.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          return { success: false, imported: 0, errors: ['Arquivo vazio ou sem dados'] };
        }
        
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const errors: string[] = [];
        let imported = 0;
        
        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].match(/("([^"]*)"|[^,]+)/g) || [];
            const row = values.map(v => v.replace(/^"|"$/g, '').trim());
            
            const leadData: Record<string, string> = {};
            headers.forEach((header, idx) => {
              leadData[header] = row[idx] || '';
            });
            
            if (!leadData.nome || !leadData.email || !leadData.cpf) {
              errors.push(`Linha ${i + 1}: Dados obrigatórios ausentes`);
              continue;
            }
            
            const existingLead = await prisma.lead.findFirst({
              where: { OR: [{ email: leadData.email }, { cpf: leadData.cpf }] },
            });
            
            if (existingLead) {
              errors.push(`Linha ${i + 1}: Lead já existe (${leadData.email})`);
              continue;
            }
            
            await prisma.lead.create({
              data: {
                name: leadData.nome,
                email: leadData.email,
                phone: leadData.telefone || '',
                cpf: leadData.cpf,
                source: leadData.source || 'Importação',
                origin: leadData.origin || 'Importação',
                procedure: leadData.procedimento || '',
                status: 'NEW',
              },
            });
            
            imported++;
          } catch (err) {
            errors.push(`Linha ${i + 1}: Erro ao processar`);
          }
        }
        
        return { success: true, imported, errors: errors.slice(0, 10) };
      } catch (error: any) {
        return { success: false, imported: 0, errors: [error.message] };
      }
    },
    createPatient: async (_: unknown, { input }: { input: {
      leadId: string;
      dateOfBirth: string;
      medicalRecord?: string;
      address?: string;
      sex?: string;
      weight?: number;
      height?: number;
      howMet?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
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
          sex: input.sex,
          weight: input.weight,
          height: input.height,
          howMet: input.howMet || lead.origin,
        },
        include: { lead: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Patient',
          entityId: patient.id,
          action: 'CREATED',
          newValue: {
            dateOfBirth: input.dateOfBirth,
            medicalRecord: input.medicalRecord,
            address: input.address,
            sex: input.sex,
            weight: input.weight,
            height: input.height,
            howMet: input.howMet,
          },
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      // Validate patient exists
      const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
      if (!patient) throw new Error('Paciente não encontrado');
      
      // Validate surgeon exists
      const surgeon = await prisma.surgeon.findUnique({ where: { id: input.surgeonId } });
      if (!surgeon) throw new Error('Médico não encontrado');
      
      // IDs are already decoded by ID scalar
      const appointment = await prisma.appointment.create({
        data: {
          patientId: input.patientId,
          surgeonId: input.surgeonId,
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
          newValue: { procedure: input.procedure, scheduledAt: input.scheduledAt },
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      // ID is already decoded by ID scalar
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
          oldValue: current.status,
          newValue: input.status,
          reason: input.reason || 'Alteração de status',
          userId: context.user?.userId,
          appointmentId: input.id,
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
      if (!context.user) throw new Error('Usuário não autenticado');
      
      // ID is already decoded by ID scalar
      const current = await prisma.appointment.findUnique({ where: { id: input.id } });
      if (!current) throw new Error('Agendamento não encontrado');

      // Validate patient if provided
      if (input.patientId) {
        const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
        if (!patient) throw new Error('Paciente não encontrado');
      }
      
      // Validate surgeon if provided
      if (input.surgeonId) {
        const surgeon = await prisma.surgeon.findUnique({ where: { id: input.surgeonId } });
        if (!surgeon) throw new Error('Médico não encontrado');
      }

      const data: Record<string, unknown> = {};
      if (input.patientId) data.patientId = input.patientId;
      if (input.surgeonId) data.surgeonId = input.surgeonId;
      if (input.procedure) data.procedure = input.procedure;
      if (input.scheduledAt) data.scheduledAt = new Date(input.scheduledAt);
      if (input.notes !== undefined) data.notes = input.notes;

      const updated = await prisma.appointment.update({
        where: { id: input.id },
        data,
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: input.id,
          action: 'UPDATED',
          oldValue: { procedure: current.procedure, scheduledAt: current.scheduledAt },
          newValue: { procedure: updated.procedure, scheduledAt: updated.scheduledAt },
          reason: 'Agendamento atualizado',
          userId: context.user?.userId,
          appointmentId: input.id,
        },
      });

      return updated;
    },
    deleteAppointment: async (_: unknown, { input }: { input: { id: string; confirmed?: boolean } }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const { id, confirmed } = input;
      if (!confirmed) {
        throw new Error('Confirmação necessária para excluir agendamento. Defina confirmed: true.');
      }
      
      // ID is already decoded by ID scalar
      const current = await prisma.appointment.findUnique({ where: { id } });
      if (!current) throw new Error('Agendamento não encontrado');

      await prisma.appointment.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: id,
          action: 'DELETED',
          oldValue: { procedure: current.procedure, scheduledAt: current.scheduledAt },
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
    }}, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'criação de cirurgião');

      const existing = await prisma.surgeon.findFirst({
        where: { OR: [{ crm: input.crm }, { email: input.email }] },
      });
      if (existing) {
        throw new Error('RN01_VIOLATION: CRM ou e-mail já cadastrado');
      }

      return prisma.surgeon.create({ 
        data: {
          ...input,
          appointmentDuration: 30,
        }
      });
    },
    createUser: async (_: unknown, { input }: { input: {
      email: string;
      name: string;
      role: string;
      password: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
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
          role: input.role as UserRole,
          password: hashedPassword,
        } 
      });
    },
    toggleUserStatus: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'alteração de status de usuário');
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const user = await prisma.user.findUnique({ where: { id: decodedId } });
      if (!user) throw new Error('Usuário não encontrado');
      
      // Prevent admin from deactivating themselves
      if (decodedId === context.user.userId) {
        throw new Error('Não é possível desativar sua própria conta');
      }

      const newStatus = !user.isActive;

      await prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: { isActive: user.isActive },
          newValue: { isActive: newStatus },
          reason: 'Ativação/Desativação de usuário',
          userId: context.user.userId,
        },
      });

      // PROACTIVE TOKEN REVOCATION: When deactivating a user, immediately
      // invalidate all their active tokens via Redis blacklist
      if (!newStatus) {
        await revokeUserTokens(decodedId);
        logger.info('Auth:Revocation', `User ${decodedId} deactivated — tokens revoked`);
      } else {
        // Re-activating: clear the blacklist so they can login again
        await clearTokenRevocation(decodedId);
        logger.info('Auth:Revocation', `User ${decodedId} reactivated — revocation cleared`);
      }

      return prisma.user.update({
        where: { id: decodedId },
        data: { isActive: newStatus },
      });
    },
    updateUser: async (_: unknown, { id, input }: { id: string; input: { role?: string; isActive?: boolean } }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const user = await prisma.user.findUnique({ where: { id: decodedId } });
      if (!user) throw new Error('Usuário não encontrado');
      
      // Prevent self-demotion
      if (decodedId === context.user.userId && input.role && input.role !== 'ADMIN') {
        throw new Error('Não é possível remover seu próprio cargo de administrador');
      }
      
      const updateData: { role: string; isActive: boolean } = { role: user.role, isActive: user.isActive };
      if (input.role) updateData.role = input.role;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      
      await prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: decodedId,
          action: 'UPDATED',
          oldValue: { role: user.role, isActive: user.isActive },
          newValue: { role: updateData.role, isActive: updateData.isActive },
          reason: 'Atualização de usuário pelo admin',
          userId: context.user.userId,
        },
      });
      
      return prisma.user.update({
        where: { id: decodedId },
        data: { role: updateData.role as UserRole, isActive: updateData.isActive },
      });
    },
    updateProfile: async (_: unknown, { input }: { input: { name?: string; password?: string } }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.password) {
        updateData.password = await hashPassword(input.password);
      }
      
      return prisma.user.update({
        where: { id: context.user.userId },
        data: updateData,
      });
    },
    updatePatient: async (_: unknown, { input }: { input: { id: string; dateOfBirth?: string; medicalRecord?: string; address?: string; sex?: string; weight?: number; height?: number; howMet?: string; reason?: string } }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      let decodedId = input.id;
      try {
        const decoded = Buffer.from(input.id, 'base64url').toString('utf-8');
        if (decoded && decoded.match(/^[a-zA-Z0-9_-]+$/)) {
          decodedId = decoded;
        }
      } catch {
        decodedId = input.id;
      }
      
      const current = await prisma.patient.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Paciente não encontrado');
      
      if (input.medicalRecord) {
        const existing = await prisma.patient.findUnique({ where: { medicalRecord: input.medicalRecord } });
        if (existing && existing.id !== decodedId) {
          throw new Error('RN01_VIOLATION: Prontuário já cadastrado por outro paciente');
        }
      }
      
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};
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
      if (input.sex !== undefined) {
        updateData.sex = input.sex;
        changes.sex = { from: current.sex, to: input.sex };
      }
      if (input.weight !== undefined) {
        updateData.weight = input.weight;
        changes.weight = { from: current.weight, to: input.weight };
      }
      if (input.height !== undefined) {
        updateData.height = input.height;
        changes.height = { from: current.height, to: input.height };
      }
      if (input.howMet !== undefined) {
        updateData.howMet = input.howMet;
        changes.howMet = { from: current.howMet, to: input.howMet };
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
          oldValue: {
            dateOfBirth: current.dateOfBirth,
            medicalRecord: current.medicalRecord,
            address: current.address,
            sex: current.sex,
            weight: current.weight,
            height: current.height,
            howMet: current.howMet,
          },
          newValue: changes as any,
          reason: input.reason || 'Atualização de dados do paciente',
          userId: context.user?.userId,
        },
      });
      
      return updated;
    },
    updateDocumentStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const current = await prisma.document.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Documento não encontrado');

      await prisma.auditLog.create({
        data: {
          entityType: 'Document',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: { status: current.status },
          newValue: { status },
          reason: 'Atualização do status do documento',
          userId: context.user?.userId,
        },
      });
      return prisma.document.update({
        where: { id: decodedId },
        data: { status: status as DocumentStatus },
      });
    },
    updatePostOpStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const current = await prisma.postOp.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Pós-operatório não encontrado');

      await prisma.auditLog.create({
        data: {
          entityType: 'PostOp',
          entityId: decodedId,
          action: 'STATUS_UPDATED',
          oldValue: { status: current.status },
          newValue: { status },
          reason: 'Atualização do status do retorno pós-operatório',
          userId: context.user?.userId,
        },
      });
      return prisma.postOp.update({
        where: { id: decodedId },
        data: { status: status as PostOpStatus },
      });
    },
    createContact: async (_: unknown, { input }: { input: {
      leadId: string;
      date: string;
      type: string;
      direction: string;
      status: string;
      message: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedLeadId = Buffer.from(input.leadId, 'base64url').toString('utf-8');
      
      return prisma.contact.create({
        data: {
          leadId: decodedLeadId,
          date: new Date(input.date),
          type: input.type as ContactType,
          direction: input.direction as ContactDirection,
          status: input.status as ContactStatus,
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
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      
      return prisma.document.create({
        data: {
          patientId: decodedPatientId,
          name: input.name,
          type: input.type as DocumentType,
          date: new Date(input.date),
          status: (input.status as DocumentStatus) || 'PENDING',
        },
      });
    },
    createPostOp: async (_: unknown, { input }: { input: {
      patientId: string;
      date: string;
      type: string;
      description: string;
      status?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      
      return prisma.postOp.create({
        data: {
          patientId: decodedPatientId,
          date: new Date(input.date),
          type: input.type as PostOpType,
          description: input.description,
          status: (input.status as PostOpStatus) || 'SCHEDULED',
        },
      });
    },
    createMessageTemplate: async (_: unknown, { input }: { input: {
      name: string;
      channel: string;
      content: string;
      triggerDays?: number;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      return prisma.messageTemplate.create({
        data: {
          name: input.name,
          channel: input.channel as MessageChannel,
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
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const existing = await prisma.messageTemplate.findUnique({ where: { id: input.id } });
      if (!existing) throw new Error('Template não encontrado');

      const updateData: Record<string, unknown> = {};
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
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      const existing = await prisma.messageTemplate.findUnique({ where: { id } });
      if (!existing) throw new Error('Template não encontrado');

      await prisma.messageTemplate.delete({ where: { id } });
      return { success: true, message: 'Template excluído com sucesso' };
    },
    markNotificationAsRead: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8').replace(/^[^:]+:/, '') || id;
      return prisma.notification.update({
        where: { id: decodedId.length < 30 ? id : decodedId },
        data: { status: 'READ' },
        include: { appointment: { include: { patient: { include: { lead: true } }, surgeon: true } } },
      });
    },
    markAllNotificationsAsRead: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      await prisma.notification.updateMany({
        where: { status: { in: ['PENDING', 'SENT'] } },
        data: { status: 'READ' },
      });
      return true;
    },
    testMessageTemplate: async (_: unknown, { templateId, instanceName }: { templateId: string; instanceName: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      if (!instanceName || instanceName.trim() === '') {
        throw new Error('Selecione uma instância WhatsApp válida');
      }
      
      const { dispatchTemplateTest } = await import('../../services/whatsappQueue');
      await dispatchTemplateTest(templateId, instanceName, context.user.userId);
      return true;
    },
    createEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY is not configured');

      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          instanceName: name,
          token: EVOLUTION_API_KEY,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      });

       if (!response.ok) {
         let errorBody: Record<string, unknown> = {};
         try {
           errorBody = (await response.json()) as Record<string, unknown>;
         } catch (_e) {
           // Intentional empty catch - errorBody remains empty if JSON parsing fails
         }
         console.error("Evolution API Error:", errorBody);

        // Extract message from typical Evolution API error structures
        const nested = errorBody.response as Record<string, unknown> | undefined;
        const errorMessage = (nested?.message as string) || (errorBody.message as string) || JSON.stringify(errorBody);
        throw new Error(`Falha Evolution API: ${errorMessage}`);
      }

      const data = (await response.json()) as { instance?: { state?: string; instanceName?: string } };
      const state = data?.instance?.state || 'disconnected';

      return {
        connected: state === 'open' || state === 'CONNECTED',
        instanceName: data?.instance?.instanceName || name,
        state
      };
    },
    deleteEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY is not configured');

      const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${name}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_API_KEY }
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((err.message as string) || 'Falha ao deletar instância');
      }

      return true;
    },
    connectEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      if (!context.user || context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores');
      
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY is not configured');

      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${name}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((err.message as string) || 'Falha ao conectar instância');
      }

      const data = (await response.json()) as { base64?: string; pairingCode?: string };

      return {
        qrCode: data?.base64 || null,
        pairingCode: data?.pairingCode || null,
        connected: false
      };
    },
    createBudget: async (_: unknown, { input }: { input: {
      patientId: string;
      surgeonId: string;
      procedure: string;
      amount: number;
      returnDeadline?: string;
      notes?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES' && context.user.role !== 'CALL_CENTER') {
        throw new Error('Acesso restrito a administradores, vendedores ou atendentes');
      }
      
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      const decodedSurgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      
      const [patient, surgeon] = await Promise.all([
        prisma.patient.findUnique({ where: { id: decodedPatientId } }),
        prisma.surgeon.findUnique({ where: { id: decodedSurgeonId } }),
      ]);
      
      if (!patient) throw new Error('Paciente não encontrado');
      if (!surgeon) throw new Error('Médico não encontrado');
      
      const budget = await prisma.budget.create({
        data: {
          patientId: decodedPatientId,
          surgeonId: decodedSurgeonId,
          procedure: input.procedure,
          amount: input.amount,
          returnDeadline: input.returnDeadline ? new Date(input.returnDeadline) : null,
          notes: input.notes,
          status: BudgetStatus.OPEN,
        },
        include: { patient: { include: { lead: true } }, surgeon: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Budget',
          entityId: budget.id,
          action: 'CREATED',
          newValue: {
            procedure: input.procedure,
            amount: input.amount,
            status: BudgetStatus.OPEN,
          },
          reason: 'Orçamento criado',
          userId: context.user?.userId,
        },
      });

      return budget;
    },
    updateBudget: async (_: unknown, { input }: { input: {
      id: string;
      procedure?: string;
      amount?: number;
      returnDeadline?: string;
      status?: BudgetStatus;
      notes?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES' && context.user.role !== 'CALL_CENTER') {
        throw new Error('Acesso restrito a administradores, vendedores ou atendentes');
      }
      
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const current = await prisma.budget.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Orçamento não encontrado');
      
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};
      if (input.procedure !== undefined) {
        updateData.procedure = input.procedure;
        changes.procedure = { from: current.procedure, to: input.procedure };
      }
      if (input.amount !== undefined) {
        updateData.amount = input.amount;
        changes.amount = { from: current.amount, to: input.amount };
      }
      if (input.returnDeadline !== undefined) {
        updateData.returnDeadline = input.returnDeadline ? new Date(input.returnDeadline) : null;
        changes.returnDeadline = { from: current.returnDeadline, to: input.returnDeadline };
      }
      if (input.status !== undefined) {
        updateData.status = input.status;
        changes.status = { from: current.status, to: input.status };
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
        changes.notes = { from: current.notes, to: input.notes };
      }
      
      const updated = await prisma.budget.update({
        where: { id: decodedId },
        data: updateData,
        include: { patient: { include: { lead: true } }, surgeon: true },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Budget',
          entityId: decodedId,
          action: 'UPDATED',
          oldValue: {
            procedure: current.procedure,
            amount: current.amount,
            status: current.status,
          },
          newValue: changes as any,
          reason: 'Orçamento atualizado',
          userId: context.user?.userId,
        },
      });

      return updated;
    },
    deleteBudget: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES') {
        throw new Error('Acesso restrito a administradores e vendedores');
      }
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const existing = await prisma.budget.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Orçamento não encontrado');
      
      if (existing.status === BudgetStatus.CONTRACT_SIGNED) {
        throw new Error('Não é possível excluir orçamento com contrato fechado');
      }
      
      await prisma.budget.delete({ where: { id: decodedId } });
      return { success: true, message: 'Orçamento excluído com sucesso' };
    },
    createBudgetFollowUp: async (_: unknown, { input }: { input: {
      budgetId: string;
      date: string;
      notes?: string;
      respondedBy?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'SALES' && context.user.role !== 'CALL_CENTER') {
        throw new Error('Acesso restrito a administradores, vendedores ou atendentes');
      }
      
      const decodedBudgetId = Buffer.from(input.budgetId, 'base64url').toString('utf-8');
      
      return prisma.budgetFollowUp.create({
        data: {
          budgetId: decodedBudgetId,
          date: new Date(input.date),
          notes: input.notes,
          respondedBy: input.respondedBy,
        },
      });
    },
    createComplaint: async (_: unknown, { input }: { input: {
      patientId: string;
      area: string;
      description: string;
      responseDeadline?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN' && context.user.role !== 'RECEPTION' && context.user.role !== 'CALL_CENTER') {
        throw new Error('Acesso restrito a administradores ou atendimento');
      }
      
      const decodedPatientId = Buffer.from(input.patientId, 'base64url').toString('utf-8');
      
      const patient = await prisma.patient.findUnique({ where: { id: decodedPatientId } });
      if (!patient) throw new Error('Paciente não encontrado');
      
      return prisma.complaint.create({
        data: {
          patientId: decodedPatientId,
          area: input.area,
          description: input.description,
          responseDeadline: input.responseDeadline ? new Date(input.responseDeadline) : null,
          status: ComplaintStatus.OPEN,
        },
        include: { patient: { include: { lead: true } } },
      });
    },
    updateComplaint: async (_: unknown, { input }: { input: {
      id: string;
      status?: ComplaintStatus;
      resolution?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const current = await prisma.complaint.findUnique({ where: { id: decodedId } });
      if (!current) throw new Error('Reclamação não encontrada');
      
      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.resolution !== undefined) updateData.resolution = input.resolution;
      
      return prisma.complaint.update({
        where: { id: decodedId },
        data: updateData,
        include: { patient: { include: { lead: true } } },
      });
    },
    deleteComplaint: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const existing = await prisma.complaint.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Reclamação não encontrada');
      
      await prisma.complaint.delete({ where: { id: decodedId } });
      return { success: true, message: 'Reclamação excluída com sucesso' };
    },
    createTreatment: async (_: unknown, { input }: { input: {
      complaintId: string;
      date: string;
      sector: string;
      description: string;
      solution?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedComplaintId = Buffer.from(input.complaintId, 'base64url').toString('utf-8');
      
      const complaint = await prisma.complaint.findUnique({ where: { id: decodedComplaintId } });
      if (!complaint) throw new Error('Reclamação não encontrada');
      
      const treatment = await prisma.treatment.create({
        data: {
          complaintId: decodedComplaintId,
          date: new Date(input.date),
          sector: input.sector,
          description: input.description,
          solution: input.solution,
        },
      });
      
      if (input.solution) {
        await prisma.complaint.update({
          where: { id: decodedComplaintId },
          data: { status: ComplaintStatus.RESOLVED },
        });
      }
      
      return treatment;
    },
    createExtraAvailability: async (_: unknown, { input }: { input: {
      surgeonId: string;
      date: string;
      startTime: string;
      endTime: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedSurgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      
      const surgeon = await prisma.surgeon.findUnique({ where: { id: decodedSurgeonId } });
      if (!surgeon) throw new Error('Médico não encontrado');
      
      return prisma.extraAvailabilitySlot.create({
        data: {
          surgeonId: decodedSurgeonId,
          date: new Date(input.date),
          startTime: input.startTime,
          endTime: input.endTime,
          isActive: true,
        },
      });
    },
    updateExtraAvailability: async (_: unknown, { input }: { input: {
      id: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const existing = await prisma.extraAvailabilitySlot.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Agenda extra não encontrada');
      
      const updateData: Record<string, unknown> = {};
      if (input.date !== undefined) updateData.date = new Date(input.date);
      if (input.startTime !== undefined) updateData.startTime = input.startTime;
      if (input.endTime !== undefined) updateData.endTime = input.endTime;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      
      return prisma.extraAvailabilitySlot.update({
        where: { id: decodedId },
        data: updateData,
      });
    },
    deleteExtraAvailability: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const existing = await prisma.extraAvailabilitySlot.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Agenda extra não encontrada');
      
      await prisma.extraAvailabilitySlot.delete({ where: { id: decodedId } });
      return { success: true, message: 'Agenda extra excluída com sucesso' };
    },
    createScheduleBlock: async (_: unknown, { input }: { input: {
      surgeonId: string;
      startDate: string;
      endDate: string;
      reason?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedSurgeonId = Buffer.from(input.surgeonId, 'base64url').toString('utf-8');
      
      const surgeon = await prisma.surgeon.findUnique({ where: { id: decodedSurgeonId } });
      if (!surgeon) throw new Error('Médico não encontrado');
      
      return prisma.scheduleBlock.create({
        data: {
          surgeonId: decodedSurgeonId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          reason: input.reason,
        },
      });
    },
    updateScheduleBlock: async (_: unknown, { input }: { input: {
      id: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    }}, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(input.id, 'base64url').toString('utf-8');
      const existing = await prisma.scheduleBlock.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Bloqueio não encontrado');
      
      const updateData: Record<string, unknown> = {};
      if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
      if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
      if (input.reason !== undefined) updateData.reason = input.reason;
      
      return prisma.scheduleBlock.update({
        where: { id: decodedId },
        data: updateData,
      });
    },
    deleteScheduleBlock: async (_: unknown, { id }: { id: string }, context: Context) => {
      if (!context.user) throw new Error('Usuário não autenticado');
      if (context.user.role !== 'ADMIN') {
        throw new Error('Acesso restrito a administradores');
      }
      
      const decodedId = Buffer.from(id, 'base64url').toString('utf-8');
      const existing = await prisma.scheduleBlock.findUnique({ where: { id: decodedId } });
      if (!existing) throw new Error('Bloqueio não encontrado');
      
      await prisma.scheduleBlock.delete({ where: { id: decodedId } });
      return { success: true, message: 'Bloqueio excluído com sucesso' };
    },
  },
};

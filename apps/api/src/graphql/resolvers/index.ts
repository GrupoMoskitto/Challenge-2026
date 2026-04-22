import { prisma, checkUniqueness } from '@crmed/database';
import { LeadStatus, AppointmentStatus, DocumentStatus, PostOpStatus, BudgetStatus, ComplaintStatus, Prisma } from '@prisma/client';
import { format, subDays } from 'date-fns';
import { DateTimeScalar, IDScalar, JSONScalar } from '../scalars';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyRefreshToken, checkRateLimit, resetRateLimit, COOKIE_OPTIONS, isTokenRevoked, revokeUserTokens, clearTokenRevocation } from '../../auth';
import { dispatchLeadWelcome } from '../../services/whatsappQueue';
import { assertAuthenticated, assertRole, enforceStatusChange } from '../../config/rbac';
import { logger } from '../../config/logger';

const encodeBase64 = (id: string): string => {
  return Buffer.from(id).toString('base64url');
};

const decodeId = (id: string): string => {
  if (!id || typeof id !== 'string') return id;
  
  // Heuristics for already decoded IDs (cuids, uuids, or prefixed test IDs)
  if (id.startsWith('c') && id.length >= 20) return id; // cuid
  if (id.includes('-') && id.length >= 8) return id;    // uuid or lead-123
  if (id.length < 8) return id;                         // too short for base64url-cuid

  try {
    const decoded = Buffer.from(id, 'base64url').toString('utf-8');
    
    // Check if the decoded string looks like a cuid (starts with c) or has a prefix-id format
    const isLikelyCuid = decoded.startsWith('c') && decoded.length >= 20;
    const isPrefixed = (decoded.includes(':') || decoded.includes('-')) && decoded.length > 5;
    
    // eslint-disable-next-line no-control-regex
    const hasControlChars = /[\u0000-\u0008\u000E-\u001F\u007F]/.test(decoded);
    
    if ((isLikelyCuid || isPrefixed) && !hasControlChars) {
      // Return the ID part if it's prefix:id, or the whole thing if it's prefix-id or just cuid
      if (decoded.includes(':')) return decoded.split(':').pop() || decoded;
      return decoded;
    }
    
    return id;
  } catch {
    return id;
  }
};

export interface Context {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  res?: import('express').Response;
  ip?: string;
}

const surgeonCache = new WeakMap<Context, string | null>();

function getSurgeonFromContext(context: Context): string | null {
  return surgeonCache.get(context) ?? null;
}

function setSurgeonInContext(context: Context, surgeonId: string | null): void {
  surgeonCache.set(context, surgeonId);
}

const MAX_WEIGHT_KG = 400;
const MAX_HEIGHT_CM = 300;

function validatePatientData(input: any) {
  if (input.weight !== undefined && input.weight !== null) {
    const w = typeof input.weight === 'string' ? parseFloat(input.weight.replace(',', '.')) : input.weight;
    if (isNaN(w) || w <= 0 || w > MAX_WEIGHT_KG) {
      throw new Error(`Peso inválido. Deve ser entre 0 e ${MAX_WEIGHT_KG}kg.`);
    }
  }
  if (input.height !== undefined && input.height !== null) {
    const h = typeof input.height === 'string' ? parseFloat(input.height.replace(',', '.')) : input.height;
    if (isNaN(h) || h <= 0 || h > MAX_HEIGHT_CM) {
      throw new Error(`Altura inválida. Deve ser entre 0 e ${MAX_HEIGHT_CM}cm.`);
    }
  }
}

interface CreateLeadInput {
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  origin?: string;
  procedure?: string;
  whatsappActive?: boolean;
  notes?: string;
  preferredDoctor?: string;
}

interface UpdateLeadInput extends CreateLeadInput {
  id: string;
  status?: LeadStatus;
  reason?: string;
}

interface CreatePatientInput {
  leadId: string;
  dateOfBirth: string;
  medicalRecord?: string;
  address?: string;
  sex?: string;
  weight?: number;
  height?: number;
  howMet?: string;
}

interface UpdatePatientInput extends Partial<CreatePatientInput> {
  id: string;
  reason?: string;
}

export const resolvers = {
  ID: IDScalar,
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
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
    appointments: async (parent: { id: string }) => {
      return prisma.appointment.findMany({
        where: { patientId: parent.id },
        orderBy: { scheduledAt: 'desc' },
      });
    },
    contacts: async (parent: { leadId: string }) => {
      return prisma.contact.findMany({
        where: { leadId: parent.leadId },
        orderBy: { date: 'desc' },
      });
    },
    documents: async (parent: { id: string }) => {
      return prisma.document.findMany({
        where: { patientId: parent.id },
        orderBy: { date: 'desc' },
      });
    },
    postOps: async (parent: { id: string }) => {
      return prisma.postOp.findMany({
        where: { patientId: parent.id },
        orderBy: { date: 'desc' },
      });
    },
    auditLogs: async (parent: { id: string, leadId: string }) => {
      // Find the leadId if not provided in parent (might happen depending on query structure)
      let leadId = parent.leadId;
      if (!leadId) {
        const p = await prisma.patient.findUnique({ where: { id: parent.id }, select: { leadId: true } });
        leadId = p?.leadId || '';
      }

      return prisma.auditLog.findMany({
        where: {
          OR: [
            { patientId: parent.id },
            { AND: [ { entityType: 'Lead' }, { entityId: leadId } ] }
          ]
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  },
  AuditLog: {
    user: async (parent: { userId: string | null }) => {
      if (!parent.userId) return null;
      return prisma.user.findUnique({ where: { id: parent.userId } });
    },
  },
  Lead: {
    contacts: async (parent: { id: string }) => {
      return prisma.contact.findMany({
        where: { leadId: parent.id },
        orderBy: { date: 'desc' },
      });
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
    auditLogs: async (parent: { id: string }) => {
      return prisma.auditLog.findMany({
        where: {
          OR: [
            { AND: [ { entityType: 'Lead' }, { entityId: parent.id } ] },
            { patient: { leadId: parent.id } }
          ]
        },
        orderBy: { createdAt: 'desc' },
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
    surgeon: async (parent: { surgeonId: string }) => {
      return prisma.surgeon.findUnique({ where: { id: parent.surgeonId } });
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
    availability: async (parent: { id: string }) => {
      return prisma.availabilitySlot.findMany({
        where: { surgeonId: parent.id },
        orderBy: { dayOfWeek: 'asc' },
      });
    },
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
  AvailabilitySlot: {
    id: (parent: { id: string }) => encodeBase64(parent.id),
  },
  ExtraAvailabilitySlot: {
    id: (parent: { id: string }) => encodeBase64(parent.id),
  },
  ScheduleBlock: {
    id: (parent: { id: string }) => encodeBase64(parent.id),
  },
  Query: {
    me: async (_: unknown, __: unknown, context: Context) => {
      if (!context.user) return null;
      return prisma.user.findUnique({ where: { id: context.user.userId } });
    },
    leads: async (_: unknown, { status, first, after, search }: { status?: LeadStatus; first?: number; after?: string; search?: string }, context: Context) => {
      assertAuthenticated(context);
      
      const limit = first || 20;
      const cursor = after ? decodeId(after) : undefined;
      
      const whereClause: any = status ? { status } : {};

      if (search) {
        const sanitizedSearch = search.trim().substring(0, 100);
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
      const decodedId = decodeId(id);
      return prisma.lead.findUnique({ 
        where: { id: decodedId },
        include: { contacts: { orderBy: { date: 'desc' } } },
      });
    },
    leadByCpf: async (_: unknown, { cpf }: { cpf: string }, context: Context) => {
      assertAuthenticated(context);
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
      assertAuthenticated(context);
      
      const limit = first || 20;
      const cursor = after ? decodeId(after) : undefined;

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
        const decodedSurgeonId = decodeId(where.surgeonId);
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
    patient: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.patient.findUnique({
        where: { id: decodedId },
        include: { 
          lead: { include: { contacts: true } }, 
          documents: { orderBy: { date: 'desc' } },
        },
      });
    },
    appointments: async (_: unknown, { status }: { status?: AppointmentStatus }, context: Context) => {
      assertAuthenticated(context);
      
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
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.appointment.findUnique({
        where: { id: decodedId },
        include: { patient: true, surgeon: true },
      });
    },
    appointmentsByDate: async (_: unknown, { date }: { date: string | Date }, context: Context) => {
      assertAuthenticated(context);
      const dateObj = typeof date === 'string' ? new Date(date) : (date as Date);
      
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const day = dateObj.getUTCDate();
      
      const startOfDay = Date.UTC(year, month, day, 0, 0, 0, 0);
      const endOfDay = Date.UTC(year, month, day, 23, 59, 59, 999);
      
      return prisma.appointment.findMany({
        where: {
          scheduledAt: {
            gte: new Date(startOfDay),
            lte: new Date(endOfDay),
          },
        },
        include: { patient: true, surgeon: true },
        orderBy: { scheduledAt: 'asc' },
      });
    },
    appointmentsBySurgeon: async (_: unknown, { surgeonId, startDate, endDate }: { surgeonId: string; startDate?: string; endDate?: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(surgeonId);
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
      assertAuthenticated(context);
      return prisma.surgeon.findMany({
        where: { isActive: true },
        include: { availability: true, extraAvailability: true, blocks: true },
      });
    },
    surgeon: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.surgeon.findUnique({
        where: { id: decodedId },
        include: { availability: true, extraAvailability: true, blocks: true },
      });
    },
    availableSurgeons: async (_: unknown, { date }: { date: string }, context: Context) => {
      assertAuthenticated(context);
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
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'listagem de usuários');
      
      const limit = first || 20;
      const cursor = after ? decodeId(after) : undefined;
      
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
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'visualização de usuário');
      const decodedId = decodeId(id);
      return prisma.user.findUnique({ where: { id: decodedId } });
    },
    auditLogs: async (_: unknown, { entityType, entityId, action, startDate, endDate, userId, first, after }: { entityType?: string; entityId?: string; action?: string; startDate?: string; endDate?: string; userId?: string; first?: number; after?: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'visualização de logs de auditoria');

      const limit = first || 50;
      const cursor = after ? decodeId(after) : undefined;

      const whereClause: any = {};
      if (entityType) whereClause.entityType = entityType;
      if (entityId) whereClause.entityId = decodeId(entityId);
      if (action) whereClause.action = action;
      if (userId) whereClause.userId = decodeId(userId);
      
      if (startDate || endDate) {
        whereClause.createdAt = {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        };
      }

      const [logs, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      const hasNextPage = logs.length > limit;
      const edges = logs.slice(0, limit).map((log) => ({
        node: log,
        cursor: encodeBase64(log.id),
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
    contactsByLead: async (_: unknown, { leadId }: { leadId: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(leadId);
      return prisma.contact.findMany({
        where: { leadId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    documentsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(patientId);
      return prisma.document.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'desc' },
      });
    },
    postOpsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(patientId);
      return prisma.postOp.findMany({
        where: { patientId: decodedId },
        orderBy: { date: 'asc' },
      });
    },
    upcomingPostOps: async (_: unknown, { days }: { days?: number }, context: Context) => {
      assertAuthenticated(context);
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
      assertAuthenticated(context);
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
      assertAuthenticated(context);
      return prisma.messageTemplate.findMany({
        orderBy: { name: 'asc' },
      });
    },
    messageTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.messageTemplate.findUnique({ where: { id: decodedId } });
    },
    evolutionApiInstances: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'acesso às instâncias Evolution API');
      
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
      } catch (error) {
        logger.error('EvolutionAPI:fetchInstances', (error as Error).message, error);
        return [];
      }
    },
    pingEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'teste de conexão Evolution API');

      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY is not configured');

      const start = Date.now();
      try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${name}`, {
          headers: { 'apikey': EVOLUTION_API_KEY },
        });
        const latencyMs = Date.now() - start;

        if (!response.ok) {
          return { connected: false, state: 'offline', latencyMs };
        }

        const data = (await response.json()) as { instance?: { state?: string } };
        const state = data?.instance?.state || 'unknown';

        return {
          connected: state === 'open' || state === 'CONNECTED',
          state,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - start;
        logger.error('EvolutionAPI:ping', (error as Error).message, error);
        return { connected: false, state: 'unreachable', latencyMs };
      }
    },
    testPhoneLastDigits: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      if (context.user?.role !== 'ADMIN') return null;
      
      const testPhone = process.env.DEV_ALLOWED_PHONE;
      if (!testPhone) return null;
      
      const cleanedPhone = testPhone.replace(/[^0-9]/g, '');
      return cleanedPhone.slice(-4);
    },
    budgets: async (_: unknown, { status, surgeonId }: { status?: BudgetStatus; surgeonId?: string }, context: Context) => {
      assertAuthenticated(context);
      
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (surgeonId) {
        const decodedId = decodeId(surgeonId);
        where.surgeonId = decodedId;
      }
      
      return prisma.budget.findMany({
        where,
        include: { patient: { include: { lead: true } }, surgeon: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    budget: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.budget.findUnique({
        where: { id: decodedId },
        include: { patient: { include: { lead: true } }, surgeon: true, followUps: true },
      });
    },
    budgetsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(patientId);
      return prisma.budget.findMany({
        where: { patientId: decodedId },
        include: { surgeon: true, followUps: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    complaints: async (_: unknown, { status, area }: { status?: ComplaintStatus; area?: string }, context: Context) => {
      assertAuthenticated(context);
      
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
      assertAuthenticated(context);
      const decodedId = decodeId(id);
      return prisma.complaint.findUnique({
        where: { id: decodedId },
        include: { patient: { include: { lead: true } }, treatments: true },
      });
    },
    complaintsByPatient: async (_: unknown, { patientId }: { patientId: string }, context: Context) => {
      assertAuthenticated(context);
      const decodedId = decodeId(patientId);
      return prisma.complaint.findMany({
        where: { patientId: decodedId },
        include: { treatments: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    dashboardStats: async (_: unknown, { startDate, endDate }: { startDate?: string; endDate?: string }, context: Context) => {
      assertAuthenticated(context);
      
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
      assertAuthenticated(context);
      
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
      const clientIp = context.ip || 'default-ip';
      if (!checkRateLimit(clientIp)) throw new Error('Muitas tentativas de login.');
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user || !await comparePassword(input.password, user.password)) throw new Error('Credenciais inválidas');
      if (!user.isActive) throw new Error('Usuário inativo');
      if (await isTokenRevoked(user.id)) await clearTokenRevocation(user.id);
      resetRateLimit(clientIp);
      const payload = { userId: user.id, email: user.email, role: user.role };
      const token = generateToken(payload);
      const refreshTokenValue = generateRefreshToken(payload);
      if (context.res) {
        context.res.cookie('access_token', token, COOKIE_OPTIONS.ACCESS_TOKEN);
        context.res.cookie('refresh_token', refreshTokenValue, COOKIE_OPTIONS.REFRESH_TOKEN);
      }
      return { token, refreshToken: refreshTokenValue, user };
    },
    refreshToken: async (_: unknown, { token }: { token: string }, context: Context) => {
      const decoded = verifyRefreshToken(token);
      if (!decoded || await isTokenRevoked(decoded.userId)) throw new Error('Token inválido ou revogado');
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive) throw new Error('Usuário inativo');
      const payload = { userId: user.id, email: user.email, role: user.role };
      const newToken = generateToken(payload);
      const newRefreshToken = generateRefreshToken(payload);
      if (context.res) {
        context.res.cookie('access_token', newToken, COOKIE_OPTIONS.ACCESS_TOKEN);
        context.res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);
      }
      return { token: newToken, refreshToken: newRefreshToken };
    },
    createLead: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      await checkUniqueness({ cpf: input.cpf, email: input.email, phone: input.phone });
      const newLead = await prisma.lead.create({ data: { ...input, preferredDoctor: input.preferredDoctor ? decodeId(input.preferredDoctor) : undefined, status: LeadStatus.NEW } });
      await dispatchLeadWelcome(newLead.id, newLead.name, newLead.phone, newLead.procedure || undefined);
      return newLead;
    },
    updateLead: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      const leadId = decodeId(input.id);
      const current = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!current) throw new Error('Lead não encontrado');
      await checkUniqueness({ cpf: input.cpf, email: input.email, phone: input.phone, excludeId: leadId });
      const updated = await prisma.lead.update({ where: { id: leadId }, data: { ...input, id: undefined, preferredDoctor: input.preferredDoctor ? decodeId(input.preferredDoctor) : undefined } });
      
      if (input.status && input.status !== current.status) {
        await enforceStatusChange({
          context,
          entityType: 'Lead',
          entityId: leadId,
          oldStatus: current.status,
          newStatus: input.status,
          blockedRoles: ['RECEPTION'],
          criticalStatuses: ['CONVERTED', 'LOST'],
          reason: input.reason || 'Atualização de Lead'
        });
      }
      return updated;
    },
    updateLeadStatus: async (_: unknown, { input }: { input: { id: string, status: LeadStatus, reason?: string } }, context: Context) => {
      assertAuthenticated(context);
      const leadId = decodeId(input.id);
      const current = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!current) throw new Error('Lead não encontrado');
      
      await enforceStatusChange({
        context,
        entityType: 'Lead',
        entityId: leadId,
        oldStatus: current.status,
        newStatus: input.status,
        blockedRoles: ['RECEPTION'],
        criticalStatuses: ['CONVERTED', 'LOST'],
        reason: input.reason,
      });

      const updated = await prisma.lead.update({ where: { id: leadId }, data: { status: input.status } });
      return updated;
    },
    deleteLead: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN', 'SALES'], 'exclusão de lead');
      const leadId = decodeId(id);
      await prisma.lead.deleteMany({ where: { id: leadId } });
      return { success: true };
    },
    exportLeads: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      return "URL_PLACEHOLDER";
    },
    importLeads: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      return { success: true, count: 0 };
    },
    createPatient: async (_: unknown, { input }: { input: CreatePatientInput }, context: Context) => {
      assertAuthenticated(context);
      validatePatientData(input);
      const leadId = decodeId(input.leadId);
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error('Lead não encontrado');
      return prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({ data: { ...input, leadId, dateOfBirth: new Date(input.dateOfBirth) } });
        await tx.lead.update({ where: { id: leadId }, data: { status: LeadStatus.CONVERTED } });
        
        const { leadId: _, ...auditValues } = input;
        await tx.auditLog.create({ 
          data: { 
            entityType: 'Patient', 
            entityId: patient.id, 
            action: 'CREATED', 
            userId: context.user?.userId, 
            patientId: patient.id,
            newValue: auditValues as Prisma.InputJsonValue,
            reason: 'Paciente criado a partir de lead'
          } 
        });
        return patient;
      });
    },
    updatePatient: async (_: unknown, { input }: { input: UpdatePatientInput }, context: Context) => {
      assertAuthenticated(context);
      validatePatientData(input);
      const patientId = decodeId(input.id);
      const current = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!current) throw new Error('Paciente não encontrado');

      if (input.medicalRecord && input.medicalRecord !== current.medicalRecord) {
        const existing = await prisma.patient.findUnique({ where: { medicalRecord: input.medicalRecord } });
        if (existing) throw new Error('RN01_VIOLATION: Prontuário já cadastrado por outro paciente');
      }

      const updated = await prisma.patient.update({ 
        where: { id: patientId }, 
        data: { 
          ...input, 
          id: undefined, 
          reason: undefined,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined 
        } 
      });

      const auditNewValue: any = {};
      const currentAny = current as any;
      for (const [key, value] of Object.entries(input)) {
        if (key !== 'id' && key !== 'reason' && value !== currentAny[key]) {
          if (key === 'dateOfBirth') {
            const currentStr = currentAny[key] ? new Date(currentAny[key]).toISOString().split('T')[0] : null;
            if (currentStr !== value) {
              auditNewValue[key] = { from: currentAny[key], to: new Date(value as string) };
            }
          } else {
            auditNewValue[key] = { from: currentAny[key], to: value };
          }
        }
      }

      await prisma.auditLog.create({ 
        data: { 
          entityType: 'Patient', 
          entityId: patientId, 
          action: 'UPDATED', 
          oldValue: current as Prisma.InputJsonValue, 
          newValue: auditNewValue as Prisma.InputJsonValue, 
          userId: context.user?.userId, 
          patientId,
          reason: input.reason || 'Atualização de dados'
        } 
      });
      return updated;
    },
    createAppointment: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      const appointment = await prisma.appointment.create({ data: { ...input, patientId: decodeId(input.patientId), surgeonId: decodeId(input.surgeonId), scheduledAt: new Date(input.scheduledAt) }, include: { patient: true, surgeon: true } });
      await prisma.auditLog.create({ data: { entityType: 'Appointment', entityId: appointment.id, action: 'CREATED', userId: context.user?.userId, appointmentId: appointment.id } });
      return appointment;
    },
    updateAppointment: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      const updated = await prisma.appointment.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined, patientId: input.patientId ? decodeId(input.patientId) : undefined, surgeonId: input.surgeonId ? decodeId(input.surgeonId) : undefined, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined } });
      return updated;
    },
    updateAppointmentStatus: async (_: unknown, { input }: { input: { id: string, status: AppointmentStatus } }, context: Context) => {
      assertAuthenticated(context);
      return prisma.appointment.update({ where: { id: decodeId(input.id) }, data: { status: input.status } });
    },
    deleteAppointment: async (_: unknown, { input }: { input: { id: string } }, context: Context) => {
      assertAuthenticated(context);
      await prisma.appointment.deleteMany({ where: { id: decodeId(input.id) } });
      return { success: true };
    },
    createSurgeon: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'cirurgião');
      return prisma.surgeon.create({ data: { ...input, appointmentDuration: 30 } });
    },
    createUser: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'usuário');
      const hashedPassword = await hashPassword(input.password);
      return prisma.user.create({ data: { ...input, password: hashedPassword } });
    },
    updateUser: async (_: unknown, { id, input }: { id: string, input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'usuário');
      const data = { ...input };
      if (data.password) data.password = await hashPassword(data.password);
      return prisma.user.update({ where: { id: decodeId(id) }, data });
    },
    updateProfile: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      const userId = context.user?.userId;
      const data = { ...input };
      if (data.password) data.password = await hashPassword(data.password);
      return prisma.user.update({ where: { id: userId }, data });
    },
    toggleUserStatus: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'usuário');
      const userId = decodeId(id);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('Não encontrado');
      const newStatus = !user.isActive;
      if (!newStatus) await revokeUserTokens(userId); else await clearTokenRevocation(userId);
      return prisma.user.update({ where: { id: userId }, data: { isActive: newStatus } });
    },
    createAvailabilitySlot: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      return prisma.availabilitySlot.create({ data: { ...input, surgeonId: decodeId(input.surgeonId) } });
    },
    deleteAvailabilitySlot: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      await prisma.availabilitySlot.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    createExtraAvailability: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      return prisma.extraAvailabilitySlot.create({ data: { ...input, surgeonId: decodeId(input.surgeonId), date: new Date(input.date) } });
    },
    deleteExtraAvailability: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      await prisma.extraAvailabilitySlot.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    createScheduleBlock: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      
      const surgeonId = decodeId(input.surgeonId);
      const surgeon = await prisma.surgeon.findUnique({ 
        where: { id: surgeonId } 
      });
      
      if (!surgeon) {
        throw new Error(`SURGEON_NOT_FOUND: ${surgeonId}`);
      }

      return prisma.scheduleBlock.create({ 
        data: { 
          ...input, 
          surgeonId, 
          startDate: new Date(input.startDate), 
          endDate: new Date(input.endDate) 
        } 
      });
    },
    deleteScheduleBlock: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      await prisma.scheduleBlock.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    createContact: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.contact.create({ data: { ...input, leadId: decodeId(input.leadId), date: new Date(input.date) } });
    },
    createBudget: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.budget.create({ data: { ...input, patientId: decodeId(input.patientId), surgeonId: decodeId(input.surgeonId), returnDeadline: input.returnDeadline ? new Date(input.returnDeadline) : null, status: BudgetStatus.OPEN }, include: { patient: { include: { lead: true } }, surgeon: true } });
    },
    updateBudget: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      const budgetId = decodeId(input.id);
      return prisma.budget.update({ where: { id: budgetId }, data: { ...input, id: undefined, status: input.status }, include: { patient: { include: { lead: true } }, surgeon: true } });
    },
    createBudgetFollowUp: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.budgetFollowUp.create({ data: { ...input, budgetId: decodeId(input.budgetId), date: new Date(input.date) } });
    },
    updateAvailabilitySlot: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      return prisma.availabilitySlot.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined } });
    },
    updateExtraAvailability: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      return prisma.extraAvailabilitySlot.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined, date: input.date ? new Date(input.date) : undefined } });
    },
    updateScheduleBlock: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'agenda');
      return prisma.scheduleBlock.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined, startDate: input.startDate ? new Date(input.startDate) : undefined, endDate: input.endDate ? new Date(input.endDate) : undefined } });
    },
    createComplaint: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.complaint.create({ data: { ...input, patientId: decodeId(input.patientId), responseDeadline: input.responseDeadline ? new Date(input.responseDeadline) : null, status: ComplaintStatus.OPEN }, include: { patient: { include: { lead: true } } } });
    },
    updateComplaint: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.complaint.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined }, include: { patient: { include: { lead: true } } } });
    },
    createTreatment: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.treatment.create({ data: { ...input, complaintId: decodeId(input.complaintId), date: new Date(input.date) } });
    },
    createDocument: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.document.create({ data: { ...input, patientId: decodeId(input.patientId), date: new Date(input.date) } });
    },
    updateDocumentStatus: async (_: unknown, { id, status }: { id: string, status: DocumentStatus }, context: Context) => {
      assertAuthenticated(context);
      return prisma.document.update({ where: { id: decodeId(id) }, data: { status } });
    },
    createPostOp: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      return prisma.postOp.create({ data: { ...input, patientId: decodeId(input.patientId), date: new Date(input.date) } });
    },
    updatePostOpStatus: async (_: unknown, { id, status }: { id: string, status: PostOpStatus }, context: Context) => {
      assertAuthenticated(context);
      return prisma.postOp.update({ where: { id: decodeId(id) }, data: { status } });
    },
    deleteBudget: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN', 'RECEPTION', 'SALES'], 'exclusão de orçamento');
      await prisma.budget.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    deleteComplaint: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN', 'RECEPTION'], 'exclusão de reclamação');
      await prisma.complaint.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    deleteUser: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'exclusão de usuário');
      await prisma.user.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    createMessageTemplate: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'template');
      return prisma.messageTemplate.create({ data: input });
    },
    updateMessageTemplate: async (_: unknown, { input }: { input: any }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'template');
      return prisma.messageTemplate.update({ where: { id: decodeId(input.id) }, data: { ...input, id: undefined } });
    },
    deleteMessageTemplate: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'template');
      await prisma.messageTemplate.deleteMany({ where: { id: decodeId(id) } });
      return { success: true };
    },
    createEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'evolution');
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY! }, body: JSON.stringify({ instanceName: name, token: EVOLUTION_API_KEY, qrcode: true, integration: "WHATSAPP-BAILEYS" }) });
      if (!response.ok) throw new Error('Erro Evolution API');
      const data = await response.json() as any;
      return { connected: false, instanceName: name, state: data?.instance?.state || 'disconnected' };
    },
    deleteEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'evolution');
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      await fetch(`${EVOLUTION_API_URL}/instance/delete/${name}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY! } });
      return true;
    },
    connectEvolutionInstance: async (_: unknown, { name }: { name: string }, context: Context) => {
      assertAuthenticated(context);
      assertRole(context, ['ADMIN'], 'evolution');
      const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${name}`, { headers: { 'apikey': EVOLUTION_API_KEY! } });
      const data = await response.json() as any;
      return { qrCode: data?.base64 || null, pairingCode: data?.pairingCode || null, connected: false };
    },
    markNotificationAsRead: async (_: unknown, { id }: { id: string }, context: Context) => {
      assertAuthenticated(context);
      return prisma.notification.update({ where: { id: decodeId(id) }, data: { status: 'READ' } });
    },
    testMessageTemplate: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      return true;
    },
    markAllNotificationsAsRead: async (_: unknown, __: unknown, context: Context) => {
      assertAuthenticated(context);
      await prisma.notification.updateMany({ where: { status: { in: ['PENDING', 'SENT'] } }, data: { status: 'READ' } });
      return true;
    },
  },
};

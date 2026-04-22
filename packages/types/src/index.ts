export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  source: string;
  origin?: string;
  procedure?: string;
  preferredDoctor?: string;
  whatsappActive: boolean;
  notes?: string;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type DocumentStatus = 'PENDING' | 'SIGNED' | 'UPLOADED';
export type PostOpStatus = 'SCHEDULED' | 'COMPLETED' | 'PENDING';
export type ContactType = 'WHATSAPP' | 'CALL' | 'EMAIL';

export interface Patient {
  id: string;
  leadId: string;
  dateOfBirth: Date;
  medicalRecord?: string;
  address?: string;
  lead: Lead;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientEdge {
  node: Patient;
  cursor: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface PatientConnection {
  edges: PatientEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  surgeonId: string;
  procedure: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes?: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  userId?: string;
  appointmentId?: string;
  createdAt: Date;
}

export interface Contact {
  id: string;
  leadId: string;
  date: Date;
  type: ContactType;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  message: string;
  createdAt: Date;
}

export interface Document {
  id: string;
  patientId: string;
  name: string;
  type: string;
  date: Date;
  status: DocumentStatus;
  createdAt: Date;
}

export interface PostOp {
  id: string;
  patientId: string;
  date: Date;
  type: 'RETURN' | 'REPAIR';
  description: string;
  status: PostOpStatus;
  createdAt: Date;
}

export interface Surgeon {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  email: string;
  phone: string;
  isActive: boolean;
  availability: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface PatientWhereInput {
  status?: LeadStatus;
  search?: string;
  surgeonId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreatePatientInput {
  leadId: string;
  dateOfBirth: string;
  medicalRecord?: string;
  address?: string;
}

export interface UpdatePatientInput {
  id: string;
  dateOfBirth?: string;
  medicalRecord?: string;
  address?: string;
  reason?: string;
}

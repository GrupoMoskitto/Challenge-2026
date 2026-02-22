import gql from 'graphql-tag';

export const typeDefs = gql`
  enum LeadStatus {
    NEW
    CONTACTED
    QUALIFIED
    CONVERTED
    LOST
  }

  enum AppointmentStatus {
    SCHEDULED
    CONFIRMED
    COMPLETED
    CANCELLED
    NO_SHOW
  }

  enum UserRole {
    ADMIN
    SURGEON
    CALL_CENTER
    RECEPTION
    SALES
  }

  enum NotificationType {
    CONFIRMATION
    REMINDER_2_DAYS
    REMINDER_1_DAY
    LAST_ATTEMPT
  }

  type Lead {
    id: ID!
    name: String!
    email: String!
    phone: String!
    cpf: String!
    source: String!
    status: LeadStatus!
    createdAt: String!
    updatedAt: String!
    patient: Patient
    appointments: [Appointment!]!
  }

  type Patient {
    id: ID!
    leadId: String!
    dateOfBirth: String!
    medicalRecord: String
    lead: Lead!
    createdAt: String!
    updatedAt: String!
  }

  type Surgeon {
    id: ID!
    name: String!
    specialty: String!
    crm: String!
    email: String!
    phone: String!
    isActive: Boolean!
    appointments: [Appointment!]!
    availability: [AvailabilitySlot!]!
    createdAt: String!
    updatedAt: String!
  }

  type AvailabilitySlot {
    id: ID!
    surgeonId: String!
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    isActive: Boolean!
  }

  type Appointment {
    id: ID!
    patientId: String!
    surgeonId: String!
    procedure: String!
    scheduledAt: String!
    status: AppointmentStatus!
    notes: String
    patient: Lead!
    surgeon: Surgeon!
    auditLogs: [AuditLog!]!
    notifications: [Notification!]!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    isActive: Boolean!
    auditLogs: [AuditLog!]!
    createdAt: String!
    updatedAt: String!
  }

  type AuditLog {
    id: ID!
    entityType: String!
    entityId: String!
    action: String!
    oldValue: String
    newValue: String
    reason: String
    userId: String
    appointmentId: String
    createdAt: String!
  }

  type Notification {
    id: ID!
    appointmentId: String!
    type: NotificationType!
    status: String!
    sentAt: String
    errorMessage: String
    createdAt: String!
  }

  input CreateLeadInput {
    name: String!
    email: String!
    phone: String!
    cpf: String!
    source: String!
  }

  input CreatePatientInput {
    leadId: String!
    dateOfBirth: String!
    medicalRecord: String
  }

  input CreateAppointmentInput {
    patientId: String!
    surgeonId: String!
    procedure: String!
    scheduledAt: String!
    notes: String
  }

  input CreateSurgeonInput {
    name: String!
    specialty: String!
    crm: String!
    email: String!
    phone: String!
  }

  input CreateUserInput {
    email: String!
    name: String!
    role: UserRole!
  }

  input UpdateLeadStatusInput {
    id: ID!
    status: LeadStatus!
    reason: String
  }

  input UpdateAppointmentStatusInput {
    id: ID!
    status: AppointmentStatus!
    reason: String
  }

  type Mutation {
    createLead(input: CreateLeadInput!): Lead!
    updateLeadStatus(input: UpdateLeadStatusInput!): Lead!
    createPatient(input: CreatePatientInput!): Patient!
    createAppointment(input: CreateAppointmentInput!): Appointment!
    updateAppointmentStatus(input: UpdateAppointmentStatusInput!): Appointment!
    createSurgeon(input: CreateSurgeonInput!): Surgeon!
    createUser(input: CreateUserInput!): User!
  }

  type Query {
    leads(status: LeadStatus): [Lead!]!
    lead(id: ID!): Lead
    leadByCpf(cpf: String!): Lead
    patients: [Patient!]!
    patient(id: ID!): Patient
    appointments(status: AppointmentStatus): [Appointment!]!
    appointment(id: ID!): Appointment
    surgeons: [Surgeon!]!
    surgeon(id: ID!): Surgeon
    users: [User!]!
    user(id: ID!): User
    auditLogs(entityType: String, entityId: String): [AuditLog!]!
  }
`;

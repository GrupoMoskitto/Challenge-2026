import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar ID

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

  type MutationResponse {
    success: Boolean!
    message: String
    code: String
  }

  type LeadEdge {
    node: Lead!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type LeadConnection {
    edges: [LeadEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Lead {
    id: ID!
    name: String!
    email: String!
    phone: String!
    cpf: String!
    source: String!
    status: LeadStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    patient: Patient
    appointments: [Appointment!]!
  }

  type Patient {
    id: ID!
    leadId: ID!
    dateOfBirth: DateTime!
    medicalRecord: String
    lead: Lead!
    createdAt: DateTime!
    updatedAt: DateTime!
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
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AvailabilitySlot {
    id: ID!
    surgeonId: ID!
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    isActive: Boolean!
  }

  type Appointment {
    id: ID!
    patientId: ID!
    surgeonId: ID!
    procedure: String!
    scheduledAt: DateTime!
    status: AppointmentStatus!
    notes: String
    patient: Lead!
    surgeon: Surgeon!
    auditLogs: [AuditLog!]!
    notifications: [Notification!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    isActive: Boolean!
    auditLogs: [AuditLog!]!
    createdAt: DateTime!
    updatedAt: DateTime!
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
    createdAt: DateTime!
  }

  type Notification {
    id: ID!
    appointmentId: ID!
    type: NotificationType!
    status: String!
    sentAt: DateTime
    errorMessage: String
    createdAt: DateTime!
  }

  input CreateLeadInput {
    name: String!
    email: String!
    phone: String!
    cpf: String!
    source: String!
  }

  input CreatePatientInput {
    leadId: ID!
    dateOfBirth: DateTime!
    medicalRecord: String
  }

  input CreateAppointmentInput {
    patientId: ID!
    surgeonId: ID!
    procedure: String!
    scheduledAt: DateTime!
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
    leads(status: LeadStatus, first: Int, after: String): LeadConnection
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

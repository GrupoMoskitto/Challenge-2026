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

  enum ContactType {
    WHATSAPP
    CALL
    EMAIL
  }

  enum ContactDirection {
    INBOUND
    OUTBOUND
  }

  enum ContactStatus {
    SENT
    DELIVERED
    READ
    FAILED
    ANSWERED
    MISSED
  }

  enum DocumentType {
    CONTRACT
    TERM
    EXAM
    OTHER
  }

  enum DocumentStatus {
    PENDING
    SIGNED
    UPLOADED
  }

  enum PostOpType {
    RETURN
    REPAIR
  }

  enum PostOpStatus {
    SCHEDULED
    COMPLETED
    PENDING
  }

  enum MessageChannel {
    WHATSAPP
    SMS
    EMAIL
  }

  type MutationResponse {
    success: Boolean!
    message: String
    code: String
  }

  type DeleteResult {
    success: Boolean!
    message: String
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
    origin: String
    procedure: String
    preferredDoctor: String
    whatsappActive: Boolean!
    notes: String
    status: LeadStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    patient: Patient
    appointments: [Appointment!]!
    contacts: [Contact!]!
  }

  type Patient {
    id: ID!
    leadId: ID!
    dateOfBirth: DateTime!
    medicalRecord: String
    address: String
    lead: Lead!
    contacts: [Contact!]!
    documents: [Document!]!
    postOps: [PostOp!]!
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

  type Contact {
    id: ID!
    leadId: ID!
    date: DateTime!
    type: ContactType!
    direction: ContactDirection!
    status: ContactStatus!
    message: String!
    createdAt: DateTime!
  }

  type Document {
    id: ID!
    patientId: ID!
    name: String!
    type: DocumentType!
    date: DateTime!
    status: DocumentStatus!
    createdAt: DateTime!
  }

  type PostOp {
    id: ID!
    patientId: ID!
    date: DateTime!
    type: PostOpType!
    description: String!
    status: PostOpStatus!
    createdAt: DateTime!
  }

  type MessageTemplate {
    id: ID!
    name: String!
    channel: MessageChannel!
    content: String!
    triggerDays: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
  }

  type EvolutionApiStatus {
    connected: Boolean!
    instanceName: String!
    state: String
  }

  type RefreshPayload {
    token: String!
    refreshToken: String!
  }

  input UpdateProfileInput {
    name: String
    password: String
  }

  input CreateLeadInput {
    name: String!
    email: String!
    phone: String!
    cpf: String!
    source: String!
    origin: String
    procedure: String
    preferredDoctor: String
    whatsappActive: Boolean
    notes: String
  }

  input CreatePatientInput {
    leadId: ID!
    dateOfBirth: DateTime!
    medicalRecord: String
    address: String
  }

  input UpdatePatientInput {
    id: ID!
    dateOfBirth: DateTime
    medicalRecord: String
    address: String
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
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdateLeadStatusInput {
    id: ID!
    status: LeadStatus!
    reason: String
  }

  input UpdateLeadInput {
    id: ID!
    name: String
    email: String
    phone: String
    cpf: String
    source: String
    origin: String
    procedure: String
    preferredDoctor: String
    whatsappActive: Boolean
    notes: String
    status: LeadStatus
  }

  input UpdateAppointmentStatusInput {
    id: ID!
    status: AppointmentStatus!
    reason: String
  }

  input UpdateAppointmentInput {
    id: ID!
    patientId: ID
    surgeonId: ID
    procedure: String
    scheduledAt: DateTime
    notes: String
  }

  input CreateContactInput {
    leadId: ID!
    date: DateTime!
    type: ContactType!
    direction: ContactDirection!
    status: ContactStatus!
    message: String!
  }

  input CreateDocumentInput {
    patientId: ID!
    name: String!
    type: DocumentType!
    date: DateTime!
    status: DocumentStatus
  }

  input CreatePostOpInput {
    patientId: ID!
    date: DateTime!
    type: PostOpType!
    description: String!
    status: PostOpStatus
  }

  input CreateMessageTemplateInput {
    name: String!
    channel: MessageChannel!
    content: String!
    triggerDays: Int
  }

  input UpdateMessageTemplateInput {
    id: ID!
    name: String
    channel: MessageChannel
    content: String
    triggerDays: Int
  }

  type Mutation {
    # Auth
    login(input: LoginInput!): AuthPayload!
    register(input: CreateUserInput!): AuthPayload!
    refreshToken(token: String!): RefreshPayload!

    # Leads
    createLead(input: CreateLeadInput!): Lead!
    updateLead(input: UpdateLeadInput!): Lead!
    updateLeadStatus(input: UpdateLeadStatusInput!): Lead!
    deleteLead(id: ID!): DeleteResult!

    # Patients
    createPatient(input: CreatePatientInput!): Patient!
    updatePatient(input: UpdatePatientInput!): Patient!

    # Appointments
    createAppointment(input: CreateAppointmentInput!): Appointment!
    updateAppointment(input: UpdateAppointmentInput!): Appointment!
    updateAppointmentStatus(input: UpdateAppointmentStatusInput!): Appointment!
    deleteAppointment(id: ID!): DeleteResult!

    # Surgeons
    createSurgeon(input: CreateSurgeonInput!): Surgeon!

    # Users & Profile
    createUser(input: CreateUserInput!): User!
    toggleUserStatus(id: ID!): User!
    updateProfile(input: UpdateProfileInput!): User!

    # Contacts
    createContact(input: CreateContactInput!): Contact!

    # Documents
    createDocument(input: CreateDocumentInput!): Document!
    updateDocumentStatus(id: ID!, status: DocumentStatus!): Document!

    # PostOps
    createPostOp(input: CreatePostOpInput!): PostOp!
    updatePostOpStatus(id: ID!, status: PostOpStatus!): PostOp!

    # Message Templates
    createMessageTemplate(input: CreateMessageTemplateInput!): MessageTemplate!
    updateMessageTemplate(input: UpdateMessageTemplateInput!): MessageTemplate!
    deleteMessageTemplate(id: ID!): DeleteResult!
  }

  type Query {
    # Auth
    me: User

    # Leads
    leads(status: LeadStatus, first: Int, after: String): LeadConnection
    lead(id: ID!): Lead
    leadByCpf(cpf: String!): Lead

    # Patients
    patients: [Patient!]!
    patient(id: ID!): Patient

    # Appointments
    appointments(status: AppointmentStatus): [Appointment!]!
    appointment(id: ID!): Appointment
    appointmentsByDate(date: DateTime!): [Appointment!]!
    appointmentsBySurgeon(surgeonId: ID!, startDate: DateTime, endDate: DateTime): [Appointment!]!

    # Surgeons
    surgeons: [Surgeon!]!
    surgeon(id: ID!): Surgeon
    availableSurgeons(date: DateTime!): [Surgeon!]!

    # Users
    users: [User!]!
    user(id: ID!): User

    # Audit Logs
    auditLogs(entityType: String, entityId: String): [AuditLog!]!

    # Contacts
    contactsByLead(leadId: ID!): [Contact!]!

    # Documents
    documentsByPatient(patientId: ID!): [Document!]!

    # PostOps
    postOpsByPatient(patientId: ID!): [PostOp!]!
    upcomingPostOps(days: Int): [PostOp!]!

    # Message Templates
    messageTemplates: [MessageTemplate!]!
    messageTemplate(id: ID!): MessageTemplate

    # Integration Status
    evolutionApiStatus: EvolutionApiStatus!
  }
`;

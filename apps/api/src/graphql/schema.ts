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

  enum BudgetStatus {
    OPEN
    IN_PROGRESS
    CONTRACT_SIGNED
    CLOSED
  }

  enum ComplaintStatus {
    OPEN
    IN_PROGRESS
    RESOLVED
    CLOSED
  }

  enum TreatmentStatus {
    PENDING
    IN_PROGRESS
    CLOSED
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

  enum NotificationStatus {
    PENDING
    SENT
    FAILED
    READ
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

  type ImportResult {
    success: Boolean!
    imported: Int!
    errors: [String!]!
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

  type PatientEdge {
    node: Patient!
    cursor: String!
  }

  type PatientConnection {
    edges: [PatientEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input PatientWhereInput {
    status: LeadStatus
    search: String
    surgeonId: ID
    createdFrom: DateTime
    createdTo: DateTime
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
    sex: String
    weight: Float
    height: Float
    bmi: Float
    howMet: String
    name: String
    email: String
    phone: String
    lead: Lead!
    contacts: [Contact!]!
    documents: [Document!]!
    postOps: [PostOp!]!
    auditLogs: [AuditLog!]!
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
    appointmentDuration: Int!
    appointments: [Appointment!]!
    availability: [AvailabilitySlot!]!
    extraAvailability: [ExtraAvailabilitySlot!]!
    blocks: [ScheduleBlock!]!
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

  type ExtraAvailabilitySlot {
    id: ID!
    surgeonId: ID!
    date: DateTime!
    startTime: String!
    endTime: String!
    isActive: Boolean!
  }

  type ScheduleBlock {
    id: ID!
    surgeonId: ID!
    startDate: DateTime!
    endDate: DateTime!
    reason: String
  }

  type Appointment {
    id: ID!
    patientId: ID!
    surgeonId: ID!
    procedure: String!
    scheduledAt: DateTime!
    status: AppointmentStatus!
    notes: String
    patient: Patient!
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
    status: NotificationStatus!
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

  type Budget {
    id: ID!
    patientId: ID!
    surgeonId: ID!
    procedure: String!
    amount: Float!
    returnDeadline: DateTime
    status: BudgetStatus!
    notes: String
    patient: Patient!
    surgeon: Surgeon!
    followUps: [BudgetFollowUp!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type BudgetFollowUp {
    id: ID!
    budgetId: ID!
    date: DateTime!
    notes: String
    respondedBy: String
    createdAt: DateTime!
  }

  type Complaint {
    id: ID!
    patientId: ID!
    area: String!
    description: String!
    status: ComplaintStatus!
    responseDeadline: DateTime
    resolution: String
    patient: Patient!
    treatments: [Treatment!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Treatment {
    id: ID!
    complaintId: ID!
    date: DateTime!
    sector: String!
    description: String!
    solution: String
    createdAt: DateTime!
  }

  type DashboardStats {
    totalLeads: Int!
    totalPatients: Int!
    totalAppointments: Int!
    conversionRate: Float!
    appointmentsByStatus: [StatusCount!]!
    leadsBySource: [SourceCount!]!
    leadsByStatus: [StatusCount!]!
    surgeonConversion: [SurgeonConversion!]!
    avgFirstContactTime: Float
    avgConversionTime: Float
    avgSchedulingTime: Float
    responseRate: Float!
  }

  type PerformanceMetrics {
    avgFirstContactTime: Float
    avgConversionTime: Float
    avgSchedulingTime: Float
    responseRate: Float!
    totalContacts: Int!
    totalConversions: Int!
    leadsByDay: [LeadsByDay!]!
    conversionFunnel: [ConversionFunnelStep!]!
  }

  type LeadsByDay {
    date: String!
    count: Int!
    converted: Int!
  }

  type ConversionFunnelStep {
    status: String!
    count: Int!
  }

  type StatusCount {
    status: String!
    count: Int!
  }

  type SourceCount {
    source: String!
    count: Int!
  }

  type SurgeonConversion {
    surgeonId: ID!
    surgeonName: String!
    totalAppointments: Int!
    totalConverted: Int!
    conversionRate: Float!
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
  }

  type EvolutionApiInstance {
    connected: Boolean!
    instanceName: String!
    state: String
  }

  type EvolutionConnectionPayload {
    qrCode: String
    pairingCode: String
    connected: Boolean!
  }

  type RefreshPayload {
    token: String!
    refreshToken: String!
  }

  input UpdateProfileInput {
    name: String
    password: String
  }

  input UpdateUserInput {
    role: UserRole
    isActive: Boolean
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
    sex: String
    weight: Float
    height: Float
    howMet: String
  }

  input UpdatePatientInput {
    id: ID!
    dateOfBirth: DateTime
    medicalRecord: String
    address: String
    sex: String
    weight: Float
    height: Float
    howMet: String
    reason: String
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

  input DeleteAppointmentInput {
    id: ID!
    confirmed: Boolean
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

  input CreateBudgetInput {
    patientId: ID!
    surgeonId: ID!
    procedure: String!
    amount: Float!
    returnDeadline: DateTime
    notes: String
  }

  input UpdateBudgetInput {
    id: ID!
    procedure: String
    amount: Float
    returnDeadline: DateTime
    status: BudgetStatus
    notes: String
  }

  input CreateBudgetFollowUpInput {
    budgetId: ID!
    date: DateTime!
    notes: String
    respondedBy: String
  }

  input CreateComplaintInput {
    patientId: ID!
    area: String!
    description: String!
    responseDeadline: DateTime
  }

  input UpdateComplaintInput {
    id: ID!
    status: ComplaintStatus
    resolution: String
  }

  input CreateTreatmentInput {
    complaintId: ID!
    date: DateTime!
    sector: String!
    description: String!
    solution: String
  }

  input CreateExtraAvailabilityInput {
    surgeonId: ID!
    date: DateTime!
    startTime: String!
    endTime: String!
  }

  input UpdateExtraAvailabilityInput {
    id: ID!
    date: DateTime
    startTime: String
    endTime: String
    isActive: Boolean
  }

  input CreateScheduleBlockInput {
    surgeonId: ID!
    startDate: DateTime!
    endDate: DateTime!
    reason: String
  }

  input UpdateScheduleBlockInput {
    id: ID!
    startDate: DateTime
    endDate: DateTime
    reason: String
    isActive: Boolean
  }

  type Mutation {
    # Auth
    login(input: LoginInput!): AuthPayload!
    refreshToken(token: String!): RefreshPayload!

    # Leads
    createLead(input: CreateLeadInput!): Lead!
    updateLead(input: UpdateLeadInput!): Lead!
    updateLeadStatus(input: UpdateLeadStatusInput!): Lead!
    deleteLead(id: ID!): DeleteResult!
    exportLeads(format: String): String!
    importLeads(csvContent: String!): ImportResult!

    # Patients
    createPatient(input: CreatePatientInput!): Patient!
    updatePatient(input: UpdatePatientInput!): Patient!

    # Appointments
    createAppointment(input: CreateAppointmentInput!): Appointment!
    updateAppointment(input: UpdateAppointmentInput!): Appointment!
    updateAppointmentStatus(input: UpdateAppointmentStatusInput!): Appointment!
    deleteAppointment(input: DeleteAppointmentInput!): DeleteResult!

    # Surgeons
    createSurgeon(input: CreateSurgeonInput!): Surgeon!

    # Users & Profile
    createUser(input: CreateUserInput!): User!
    deleteUser(id: ID!): DeleteResult!
    toggleUserStatus(id: ID!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    updateProfile(input: UpdateProfileInput!): User!

    # Contacts
    createContact(input: CreateContactInput!): Contact!

    # Documents
    createDocument(input: CreateDocumentInput!): Document!
    updateDocumentStatus(id: ID!, status: DocumentStatus!): Document!

    # PostOps
    createPostOp(input: CreatePostOpInput!): PostOp!
    updatePostOpStatus(id: ID!, status: PostOpStatus!): PostOp!

    # Notifications
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: Boolean!
    
    # Evolution API
    createEvolutionInstance(instanceName: String!): EvolutionApiInstance!
    deleteEvolutionInstance(instanceName: String!): Boolean!
    connectEvolutionInstance(instanceName: String!): EvolutionConnectionPayload!
    
    testMessageTemplate(templateId: ID!, instanceName: String!): Boolean!

    # Message Templates
    createMessageTemplate(input: CreateMessageTemplateInput!): MessageTemplate!
    updateMessageTemplate(input: UpdateMessageTemplateInput!): MessageTemplate!
    deleteMessageTemplate(id: ID!): DeleteResult!

    # Budgets
    createBudget(input: CreateBudgetInput!): Budget!
    updateBudget(input: UpdateBudgetInput!): Budget!
    deleteBudget(id: ID!): DeleteResult!
    createBudgetFollowUp(input: CreateBudgetFollowUpInput!): BudgetFollowUp!

    # Complaints (SAC)
    createComplaint(input: CreateComplaintInput!): Complaint!
    updateComplaint(input: UpdateComplaintInput!): Complaint!
    deleteComplaint(id: ID!): DeleteResult!
    createTreatment(input: CreateTreatmentInput!): Treatment!

    # Extra Availability & Schedule Blocks
    createExtraAvailability(input: CreateExtraAvailabilityInput!): ExtraAvailabilitySlot!
    updateExtraAvailability(input: UpdateExtraAvailabilityInput!): ExtraAvailabilitySlot!
    deleteExtraAvailability(id: ID!): DeleteResult!
    createScheduleBlock(input: CreateScheduleBlockInput!): ScheduleBlock!
    updateScheduleBlock(input: UpdateScheduleBlockInput!): ScheduleBlock!
    deleteScheduleBlock(id: ID!): DeleteResult!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type Query {
    # Auth
    me: User

    # Leads
    leads(status: LeadStatus, first: Int, after: String, search: String): LeadConnection
    lead(id: ID!): Lead
    leadByCpf(cpf: String!): Lead

    # Patients
    patients(first: Int, after: String, where: PatientWhereInput): PatientConnection!
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
    users(first: Int, after: String): UserConnection!
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

    # Notifications
    notifications(status: NotificationStatus, first: Int): [Notification!]!
    unreadNotificationsCount: Int!

    # Message Templates
    messageTemplates: [MessageTemplate!]!
    messageTemplate(id: ID!): MessageTemplate

    # Budgets
    budgets(status: BudgetStatus, surgeonId: ID): [Budget!]!
    budget(id: ID!): Budget
    budgetsByPatient(patientId: ID!): [Budget!]!

    # Complaints (SAC)
    complaints(status: ComplaintStatus, area: String): [Complaint!]!
    complaint(id: ID!): Complaint
    complaintsByPatient(patientId: ID!): [Complaint!]!

    # Dashboard
    dashboardStats(startDate: DateTime, endDate: DateTime): DashboardStats!
    performanceMetrics(startDate: DateTime, endDate: DateTime): PerformanceMetrics!

    # Integration Status
    evolutionApiInstances: [EvolutionApiInstance!]!
    
    # Test Configuration
    testPhoneLastDigits: String
  }
`;

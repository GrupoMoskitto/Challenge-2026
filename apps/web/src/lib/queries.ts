import { gql } from '@apollo/client';

export type { User } from '@crmed/types';

export const GET_PERFORMANCE_METRICS = gql`
  query GetPerformanceMetrics($startDate: DateTime, $endDate: DateTime) {
    performanceMetrics(startDate: $startDate, endDate: $endDate) {
      avgFirstContactTime
      avgConversionTime
      avgSchedulingTime
      responseRate
      totalContacts
      totalConversions
      leadsByDay {
        date
        count
        converted
      }
      conversionFunnel {
        status
        count
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    leads {
      totalCount
      edges {
        node {
          id
          status
          origin
          createdAt
        }
      }
    }
    appointments(status: SCHEDULED) {
      id
      scheduledAt
      procedure
      patient {
        name
      }
      surgeon {
        name
      }
    }
    surgeons {
      id
      name
      specialty
    }
  }
`;

export const GET_LEADS = gql`
  query GetLeads($status: LeadStatus, $first: Int, $after: String, $search: String) {
    leads(status: $status, first: $first, after: $after, search: $search) {
      edges {
        node {
          id
          name
          email
          phone
          cpf
          source
          origin
          procedure
          whatsappActive
          notes
          status
          createdAt
          updatedAt
          patient {
            id
          }
          appointments {
            id
            scheduledAt
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_APPOINTMENTS = gql`
  query GetAppointments($status: AppointmentStatus) {
    appointments(status: $status) {
      id
      procedure
      scheduledAt
      status
      notes
      patient {
        id
        name
        email
        phone
      }
      surgeon {
        id
        name
        specialty
      }
    }
  }
`;

export const GET_APPOINTMENTS_BY_DATE = gql`
  query GetAppointmentsByDate($date: DateTime!) {
    appointmentsByDate(date: $date) {
      id
      procedure
      scheduledAt
      status
      notes
      patient {
        id
        name
        email
        phone
      }
      surgeon {
        id
        name
        specialty
      }
    }
  }
`;

export const GET_SURGEONS = gql`
  query GetSurgeons {
    surgeons {
      id
      name
      specialty
      crm
      email
      phone
      isActive
      availability {
        id
        dayOfWeek
        startTime
        endTime
      }
    }
  }
`;

export const GET_PATIENTS = gql`
  query GetPatients($first: Int, $after: String, $where: PatientWhereInput) {
    patients(first: $first, after: $after, where: $where) {
      edges {
        node {
          id
          dateOfBirth
          medicalRecord
          address
          sex
          weight
          height
          bmi
          howMet
          lead {
            id
            name
            email
            phone
            cpf
            status
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_PATIENT = gql`
  query GetPatient($id: ID!) {
    patient(id: $id) {
      id
      dateOfBirth
      medicalRecord
      address
      sex
      weight
      height
      bmi
      howMet
      lead {
        id
        name
        email
        phone
        cpf
        status
        origin
        procedure
        contacts {
          id
          date
          type
          direction
          status
          message
        }
      }
      documents {
        id
        name
        type
        date
        status
      }
      postOps {
        id
        date
        type
        description
        status
      }
      auditLogs {
        id
        action
        oldValue
        newValue
        reason
        userId
        createdAt
      }
    }
  }
`;

export const GET_AUDIT_LOGS = gql`
  query GetAuditLogs($entityType: String, $entityId: String, $action: String, $startDate: DateTime, $endDate: DateTime, $userId: String, $first: Int, $after: String) {
    auditLogs(entityType: $entityType, entityId: $entityId, action: $action, startDate: $startDate, endDate: $endDate, userId: $userId, first: $first, after: $after) {
      edges {
        node {
          id
          entityType
          entityId
          action
          oldValue
          newValue
          reason
          userId
          user {
            id
            name
          }
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_LEAD_CONTACTS = gql`
  query GetLeadContacts($leadId: ID!) {
    contactsByLead(leadId: $leadId) {
      id
      date
      type
      direction
      status
      message
    }
    lead(id: $leadId) {
      id
      name
      auditLogs {
        id
        action
        oldValue
        newValue
        reason
        createdAt
        user {
          id
          name
        }
      }
    }
  }
`;

export const GET_MESSAGE_TEMPLATES = gql`
  query GetMessageTemplates {
    messageTemplates {
      id
      name
      channel
      content
      triggerDays
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers($first: Int, $after: String) {
    users(first: $first, after: $after) {
      edges {
        node {
          id
          name
          email
          role
          isActive
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_EVOLUTION_API_INSTANCES = gql`
  query GetEvolutionApiInstances {
    evolutionApiInstances {
      connected
      instanceName
      state
    }
  }
`;

export const GET_TEST_PHONE_LAST_DIGITS = gql`
  query GetTestPhoneLastDigits {
    testPhoneLastDigits
  }
`;

// Mutations
export const UPDATE_LEAD_STATUS = gql`
  mutation UpdateLeadStatus($input: UpdateLeadStatusInput!) {
    updateLeadStatus(input: $input) {
      id
      status
      updatedAt
    }
  }
`;

export const CREATE_LEAD = gql`
  mutation CreateLead($input: CreateLeadInput!) {
    createLead(input: $input) {
      id
      name
      email
      phone
      cpf
      source
      origin
      procedure
      whatsappActive
      notes
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_LEAD = gql`
  mutation DeleteLead($id: ID!) {
    deleteLead(id: $id) {
      success
      message
    }
  }
`;

export const EXPORT_LEADS = gql`
  mutation ExportLeads($format: String) {
    exportLeads(format: $format)
  }
`;

export const IMPORT_LEADS = gql`
  mutation ImportLeads($csvContent: String!) {
    importLeads(csvContent: $csvContent) {
      success
      imported
      errors
    }
  }
`;

export const UPDATE_LEAD = gql`
  mutation UpdateLead($input: UpdateLeadInput!) {
    updateLead(input: $input) {
      id
      name
      email
      phone
      cpf
      source
      origin
      procedure
      whatsappActive
      notes
      status
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_APPOINTMENT = gql`
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      id
      procedure
      scheduledAt
      status
    }
  }
`;

export const UPDATE_APPOINTMENT_STATUS = gql`
  mutation UpdateAppointmentStatus($input: UpdateAppointmentStatusInput!) {
    updateAppointmentStatus(input: $input) {
      id
      status
      updatedAt
    }
  }
`;

export const UPDATE_APPOINTMENT = gql`
  mutation UpdateAppointment($input: UpdateAppointmentInput!) {
    updateAppointment(input: $input) {
      id
      procedure
      scheduledAt
      status
    }
  }
`;

export const DELETE_APPOINTMENT = gql`
  mutation DeleteAppointment($input: DeleteAppointmentInput!) {
    deleteAppointment(input: $input) {
      success
      message
    }
  }
`;

export const CREATE_CONTACT = gql`
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
      id
      date
      type
      message
    }
  }
`;

export const CREATE_MESSAGE_TEMPLATE = gql`
  mutation CreateMessageTemplate($input: CreateMessageTemplateInput!) {
    createMessageTemplate(input: $input) {
      id
      name
      channel
      content
      triggerDays
    }
  }
`;

export const UPDATE_MESSAGE_TEMPLATE = gql`
  mutation UpdateMessageTemplate($input: UpdateMessageTemplateInput!) {
    updateMessageTemplate(input: $input) {
      id
      name
      channel
      content
      triggerDays
    }
  }
`;

export const DELETE_MESSAGE_TEMPLATE = gql`
  mutation DeleteMessageTemplate($id: ID!) {
    deleteMessageTemplate(id: $id) {
      success
      message
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
      role
      isActive
    }
  }
`;

export const TOGGLE_USER_STATUS = gql`
  mutation ToggleUserStatus($id: ID!) {
    toggleUserStatus(id: $id) {
      id
      isActive
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      role
      isActive
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_PATIENT = gql`
  mutation UpdatePatient($input: UpdatePatientInput!) {
    updatePatient(input: $input) {
      id
      dateOfBirth
      medicalRecord
      address
      sex
      weight
      height
      bmi
      howMet
      lead {
        id
        name
        email
        phone
        cpf
      }
    }
  }
`;

export const CREATE_PATIENT = gql`
  mutation CreatePatient($input: CreatePatientInput!) {
    createPatient(input: $input) {
      id
      dateOfBirth
      medicalRecord
      address
      sex
      weight
      height
      bmi
      howMet
      lead {
        id
        name
        email
        phone
        cpf
        status
      }
    }
  }
`;

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      name
      type
      date
      status
    }
  }
`;

export const UPDATE_DOCUMENT_STATUS = gql`
  mutation UpdateDocumentStatus($id: ID!, $status: DocumentStatus!) {
    updateDocumentStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const CREATE_POST_OP = gql`
  mutation CreatePostOp($input: CreatePostOpInput!) {
    createPostOp(input: $input) {
      id
      date
      type
      description
      status
    }
  }
`;

export const UPDATE_POST_OP_STATUS = gql`
  mutation UpdatePostOpStatus($id: ID!, $status: PostOpStatus!) {
    updatePostOpStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const TEST_MESSAGE_TEMPLATE = gql`
  mutation TestMessageTemplate($templateId: ID!, $instanceName: String!) {
    testMessageTemplate(templateId: $templateId, instanceName: $instanceName)
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($status: NotificationStatus, $first: Int) {
    notifications(status: $status, first: $first) {
      id
      type
      status
      message
      scheduledFor
      createdAt
      appointment {
        id
        procedure
        scheduledAt
        patient {
          id
          lead {
            name
            phone
          }
        }
        surgeon {
          name
        }
      }
    }
  }
`;

export const GET_UNREAD_NOTIFICATIONS_COUNT = gql`
  query GetUnreadNotificationsCount {
    unreadNotificationsCount
  }
`;

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      id
      status
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

export const CREATE_EVOLUTION_INSTANCE = gql`
  mutation CreateEvolutionInstance($name: String!) {
    createEvolutionInstance(name: $name) {
      connected
      instanceName
      state
    }
  }
`;

export const DELETE_EVOLUTION_INSTANCE = gql`
  mutation DeleteEvolutionInstance($name: String!) {
    deleteEvolutionInstance(name: $name)
  }
`;

export const CONNECT_EVOLUTION_INSTANCE = gql`
  mutation ConnectEvolutionInstance($name: String!) {
    connectEvolutionInstance(name: $name) {
      qrCode
      pairingCode
      connected
    }
  }
`;

export const PING_EVOLUTION_INSTANCE = gql`
  query PingEvolutionInstance($name: String!) {
    pingEvolutionInstance(name: $name) {
      connected
      state
      latencyMs
    }
  }
`;

export const GET_SURGEONS_SCHEDULE = gql`
  query GetSurgeonsSchedule {
    surgeons {
      id
      name
      specialty
      availability {
        id
        dayOfWeek
        startTime
        endTime
        isActive
      }
      extraAvailability {
        id
        date
        startTime
        endTime
        isActive
      }
      blocks {
        id
        startDate
        endDate
        reason
      }
    }
  }
`;

export const CREATE_AVAILABILITY_SLOT = gql`
  mutation CreateAvailabilitySlot($input: CreateAvailabilitySlotInput!) {
    createAvailabilitySlot(input: $input) {
      id
      dayOfWeek
      startTime
      endTime
      isActive
    }
  }
`;

export const UPDATE_AVAILABILITY_SLOT = gql`
  mutation UpdateAvailabilitySlot($input: UpdateAvailabilitySlotInput!) {
    updateAvailabilitySlot(input: $input) {
      id
      dayOfWeek
      startTime
      endTime
      isActive
    }
  }
`;

export const DELETE_AVAILABILITY_SLOT = gql`
  mutation DeleteAvailabilitySlot($id: ID!) {
    deleteAvailabilitySlot(id: $id) {
      success
      message
    }
  }
`;

export const CREATE_EXTRA_AVAILABILITY = gql`
  mutation CreateExtraAvailability($input: CreateExtraAvailabilityInput!) {
    createExtraAvailability(input: $input) {
      id
      date
      startTime
      endTime
      isActive
    }
  }
`;

export const UPDATE_EXTRA_AVAILABILITY = gql`
  mutation UpdateExtraAvailability($input: UpdateExtraAvailabilityInput!) {
    updateExtraAvailability(input: $input) {
      id
      date
      startTime
      endTime
      isActive
    }
  }
`;

export const DELETE_EXTRA_AVAILABILITY = gql`
  mutation DeleteExtraAvailability($id: ID!) {
    deleteExtraAvailability(id: $id) {
      success
      message
    }
  }
`;

export const CREATE_SCHEDULE_BLOCK = gql`
  mutation CreateScheduleBlock($input: CreateScheduleBlockInput!) {
    createScheduleBlock(input: $input) {
      id
      startDate
      endDate
      reason
    }
  }
`;

export const UPDATE_SCHEDULE_BLOCK = gql`
  mutation UpdateScheduleBlock($input: UpdateScheduleBlockInput!) {
    updateScheduleBlock(input: $input) {
      id
      startDate
      endDate
      reason
    }
  }
`;

export const DELETE_SCHEDULE_BLOCK = gql`
  mutation DeleteScheduleBlock($id: ID!) {
    deleteScheduleBlock(id: $id) {
      success
      message
    }
  }
`;

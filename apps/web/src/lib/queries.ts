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
      }
      conversionFunnel {
        status
        count
      }
    }
  }
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats($startDate: DateTime, $endDate: DateTime) {
    dashboardStats(startDate: $startDate, endDate: $endDate) {
      totalLeads
      totalPatients
      totalAppointments
      conversionRate
      responseRate
      appointmentsByStatus {
        status
        count
      }
      leadsBySource {
        source
        count
      }
      leadsByStatus {
        status
        count
      }
    }
    surgeons {
      id
      name
      specialty
    }
  }
`;

export const GET_APPOINTMENTS = gql`
  query GetAppointments($status: AppointmentStatus) {
    appointments(status: $status) {
      id
      scheduledAt
      status
      procedure
      patient {
        id
        medicalRecord
        lead {
          id
          name
        }
      }
      surgeon {
        id
        name
      }
    }
  }
`;

export const GET_LEADS = gql`
  query GetLeads($first: Int, $after: String, $search: String, $status: LeadStatus) {
    leads(first: $first, after: $after, search: $search, status: $status) {
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
          preferredDoctor
          notes
          status
          whatsappActive
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

export const GET_PATIENTS = gql`
  query GetPatients($first: Int, $after: String, $where: PatientWhereInput) {
    patients(first: $first, after: $after, where: $where) {
      edges {
        node {
          id
          medicalRecord
          dateOfBirth
          address
          sex
          weight
          height
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
      leadId
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
        contacts {
          id
          type
          direction
          message
          status
          date
        }
      }
      documents {
        id
        name
        type
        status
        date
      }
      appointments {
        id
        scheduledAt
        status
        procedure
        surgeon {
          name
        }
      }
      auditLogs {
        id
        action
        entityType
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
    documentsByPatient(patientId: $id) {
      id
      name
      type
      status
      date
    }
    postOpsByPatient(patientId: $id) {
      id
      date
      type
      description
      status
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
    }
  }
`;

export const GET_APPOINTMENTS_BY_DATE = gql`
  query GetAppointmentsByDate($date: DateTime!) {
    appointmentsByDate(date: $date) {
      id
      scheduledAt
      status
      procedure
      patient {
        id
        medicalRecord
        lead {
          id
          name
        }
      }
      surgeon {
        id
        name
      }
    }
  }
`;

export const CREATE_LEAD = gql`
  mutation CreateLead($input: CreateLeadInput!) {
    createLead(input: $input) {
      id
      name
      status
    }
  }
`;

export const UPDATE_LEAD_STATUS = gql`
  mutation UpdateLeadStatus($input: UpdateLeadStatusInput!) {
    updateLeadStatus(input: $input) {
      id
      status
    }
  }
`;

export const DELETE_LEAD = gql`
  mutation DeleteLead($id: ID!) {
    deleteLead(id: $id) {
      id
    }
  }
`;

export const CREATE_PATIENT = gql`
  mutation CreatePatient($input: CreatePatientInput!) {
    createPatient(input: $input) {
      id
      medicalRecord
    }
  }
`;

export const UPDATE_PATIENT = gql`
  mutation UpdatePatient($input: UpdatePatientInput!) {
    updatePatient(input: $input) {
      id
      medicalRecord
    }
  }
`;

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      name
      type
      status
    }
  }
`;

export const CREATE_POST_OP = gql`
  mutation CreatePostOp($input: CreatePostOpInput!) {
    createPostOp(input: $input) {
      id
      status
    }
  }
`;

export const CREATE_APPOINTMENT = gql`
  mutation CreateAppointment($input: CreateAppointmentInput!) {
    createAppointment(input: $input) {
      id
      scheduledAt
    }
  }
`;

export const UPDATE_APPOINTMENT = gql`
  mutation UpdateAppointment($id: ID!, $input: UpdateAppointmentInput!) {
    updateAppointment(id: $id, input: $input) {
      id
      status
    }
  }
`;

export const DELETE_APPOINTMENT = gql`
  mutation DeleteAppointment($id: ID!) {
    deleteAppointment(id: $id) {
      id
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

export const CREATE_MESSAGE_TEMPLATE = gql`
  mutation CreateMessageTemplate($input: CreateMessageTemplateInput!) {
    createMessageTemplate(input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_MESSAGE_TEMPLATE = gql`
  mutation UpdateMessageTemplate($input: UpdateMessageTemplateInput!) {
    updateMessageTemplate(input: $input) {
      id
      name
    }
  }
`;

export const DELETE_MESSAGE_TEMPLATE = gql`
  mutation DeleteMessageTemplate($id: ID!) {
    deleteMessageTemplate(id: $id) {
      id
    }
  }
`;

export const TEST_MESSAGE_TEMPLATE = gql`
  mutation TestMessageTemplate($templateId: ID!, $instanceName: String!) {
    testMessageTemplate(templateId: $templateId, instanceName: $instanceName)
  }
`;

export const GET_LEAD_CONTACTS = gql`
  query GetLeadContacts($leadId: ID!) {
    contactsByLead(leadId: $leadId) {
      id
      type
      direction
      message
      status
      date
    }
    lead(id: $leadId) {
      id
      name
      createdAt
      auditLogs {
        id
        action
        entityType
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

export const GET_USERS = gql`
  query GetUsers {
    users {
      edges {
        node {
          id
          name
          email
          role
          isActive
        }
      }
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      role
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

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
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
      procedure
      whatsappActive
      notes
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

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      title
      message
      type
      status
      createdAt
    }
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

export const GET_TEST_PHONE_LAST_DIGITS = gql`
  query GetTestPhoneLastDigits {
    testPhoneLastDigits
  }
`;

export const GET_EVOLUTION_API_INSTANCES = gql`
  query GetEvolutionApiInstances {
    evolutionApiInstances {
      instanceName
      state
      connected
    }
  }
`;

export const CREATE_EVOLUTION_INSTANCE = gql`
  mutation CreateEvolutionInstance($name: String!) {
    createEvolutionInstance(name: $name) {
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

export const GET_SURGEONS_SCHEDULE = gql`
  query GetSurgeonsSchedule {
    surgeons {
      id
      name
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

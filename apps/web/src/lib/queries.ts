import { gql } from '@apollo/client';

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
  query GetAuditLogs($entityType: String, $entityId: String) {
    auditLogs(entityType: $entityType, entityId: $entityId) {
      id
      entityType
      entityId
      action
      oldValue
      newValue
      reason
      createdAt
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
  query GetUsers {
    users {
      id
      name
      email
      role
      isActive
      createdAt
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
  mutation DeleteAppointment($id: ID!) {
    deleteAppointment(id: $id) {
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

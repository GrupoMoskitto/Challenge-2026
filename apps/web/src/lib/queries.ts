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
  query GetLeads($status: LeadStatus, $first: Int, $after: String) {
    leads(status: $status, first: $first, after: $after) {
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
  query GetPatients {
    patients {
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

# Patient Journey Hub - API GraphQL

## Visão Geral

API GraphQL para o sistema de gestão de pacientes e jornada do cliente do Hospital São Rafael.

**URL Base:** `http://localhost:3001/graphql`

---

# Rodar local

```bash
cd apps/api
npm install
npm run dev
``

## Autenticação

### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      id
      name
      email
      role
    }
  }
}
```

**Variáveis:**
```json
{
  "input": {
    "email": "admin@hsr.com.br",
    "password": "admin123"
  }
}
```

**Headers necessários:**
```
Authorization: Bearer <TOKEN>
```

---

## Queries

### Leads

#### Listar Leads
```graphql
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
        preferredDoctor
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
      startCursor
      endCursor
    }
    totalCount
  }
}
```

#### Buscar Lead por ID
```graphql
query GetLead($id: ID!) {
  lead(id: $id) {
    id
    name
    email
    phone
    cpf
    status
    appointments {
      id
      procedure
      scheduledAt
      status
    }
  }
}
```

#### Buscar Lead por CPF
```graphql
query GetLeadByCpf($cpf: String!) {
  leadByCpf(cpf: $cpf) {
    id
    name
    email
  }
}
```

---

### Pacientes

#### Listar Pacientes
```graphql
query GetPatients {
  patients {
    id
    leadId
    dateOfBirth
    medicalRecord
    address
    lead {
      name
      email
      phone
    }
  }
}
```

#### Buscar Paciente por ID
```graphql
query GetPatient($id: ID!) {
  patient(id: $id) {
    id
    dateOfBirth
    medicalRecord
    address
    contacts {
      id
      date
      type
      direction
      status
      message
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
```

---

### Agendamentos

#### Listar Agendamentos
```graphql
query GetAppointments($status: AppointmentStatus) {
  appointments(status: $status) {
    id
    patientId
    surgeonId
    procedure
    scheduledAt
    status
    notes
    patient {
      name
      email
    }
    surgeon {
      name
      specialty
    }
  }
}
```

#### Agendamentos por Data
```graphql
query GetAppointmentsByDate($date: DateTime!) {
  appointmentsByDate(date: $date) {
    id
    procedure
    scheduledAt
    status
    patient {
      name
    }
    surgeon {
      name
    }
  }
}
```

#### Agendamentos por Cirurgião
```graphql
query GetAppointmentsBySurgeon($surgeonId: ID!, $startDate: DateTime, $endDate: DateTime) {
  appointmentsBySurgeon(surgeonId: $surgeonId, startDate: $startDate, endDate: $endDate) {
    id
    procedure
    scheduledAt
    status
  }
}
```

#### Cirurgiões Disponíveis
```graphql
query GetAvailableSurgeons($date: DateTime!) {
  availableSurgeons(date: $date) {
    id
    name
    specialty
    availability {
      dayOfWeek
      startTime
      endTime
    }
  }
}
```

---

### Cirurgiões

#### Listar Cirurgiões
```graphql
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
```

---

### Usuários

#### Meu Perfil
```graphql
query Me {
  me {
    id
    name
    email
    role
    isActive
    createdAt
  }
}
```

#### Listar Usuários
```graphql
query GetUsers {
  users {
    id
    name
    email
    role
    isActive
  }
}
```

---

### Logs de Auditoria

```graphql
query GetAuditLogs($entityType: String, $entityId: String) {
  auditLogs(entityType: $entityType, entityId: $entityId) {
    id
    entityType
    entityId
    action
    oldValue
    newValue
    reason
    userId
    createdAt
  }
}
```

---

### Templates de Mensagem

```graphql
query GetMessageTemplates {
  messageTemplates {
    id
    name
    channel
    content
    triggerDays
  }
}
```

---

## Mutations

### Criar Lead
```graphql
mutation CreateLead($input: CreateLeadInput!) {
  createLead(input: $input) {
    id
    name
    email
    status
    createdAt
  }
}
```

**Input:**
```json
{
  "input": {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "(71) 99999-9999",
    "cpf": "123.456.789-00",
    "source": "Instagram",
    "origin": "Instagram",
    "procedure": "Rinoplastia",
    "whatsappActive": true,
    "notes": "Interesse em rinoplastia"
  }
}
```

### Atualizar Status do Lead
```graphql
mutation UpdateLeadStatus($input: UpdateLeadStatusInput!) {
  updateLeadStatus(input: $input) {
    id
    status
    updatedAt
  }
}
```

**Input:**
```json
{
  "input": {
    "id": "BASE64_ID",
    "status": "CONTACTED",
    "reason": "Contato realizado"
  }
}
```

### Criar Paciente
```graphql
mutation CreatePatient($input: CreatePatientInput!) {
  createPatient(input: $input) {
    id
    leadId
    dateOfBirth
    medicalRecord
    address
  }
}
```

### Criar Agendamento
```graphql
mutation CreateAppointment($input: CreateAppointmentInput!) {
  createAppointment(input: $input) {
    id
    procedure
    scheduledAt
    status
  }
}
```

**Input:**
```json
{
  "input": {
    "patientId": "BASE64_ID",
    "surgeonId": "BASE64_ID",
    "procedure": "Rinoplastia",
    "scheduledAt": "2026-03-01T10:00:00Z",
    "notes": "Primeira consulta"
  }
}
```

### Atualizar Status do Agendamento
```graphql
mutation UpdateAppointmentStatus($input: UpdateAppointmentStatusInput!) {
  updateAppointmentStatus(input: $input) {
    id
    status
    updatedAt
  }
}
```

### Criar Contato
```graphql
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    id
    date
    type
    message
  }
}
```

### Criar Documento
```graphql
mutation CreateDocument($input: CreateDocumentInput!) {
  createDocument(input: $input) {
    id
    name
    type
    status
  }
}
```

### Criar Retorno Pós-Operatório
```graphql
mutation CreatePostOp($input: CreatePostOpInput!) {
  createPostOp(input: $input) {
    id
    date
    type
    description
    status
  }
}
```

### Criar Template de Mensagem
```graphql
mutation CreateMessageTemplate($input: CreateMessageTemplateInput!) {
  createMessageTemplate(input: $input) {
    id
    name
    channel
    content
    triggerDays
  }
}
```

---

## Tipos

### Enums

| Enum | Valores |
|------|---------|
| `LeadStatus` | NEW, CONTACTED, QUALIFIED, CONVERTED, LOST |
| `AppointmentStatus` | SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW |
| `UserRole` | ADMIN, SURGEON, CALL_CENTER, RECEPTION, SALES |
| `ContactType` | WHATSAPP, CALL, EMAIL |
| `ContactDirection` | INBOUND, OUTBOUND |
| `ContactStatus` | SENT, DELIVERED, READ, FAILED, ANSWERED, MISSED |
| `DocumentType` | CONTRACT, TERM, EXAM, OTHER |
| `DocumentStatus` | PENDING, SIGNED, UPLOADED |
| `PostOpType` | RETURN, REPAIR |
| `PostOpStatus` | SCHEDULED, COMPLETED, PENDING |
| `MessageChannel` | WHATSAPP, SMS, EMAIL |
| `NotificationType` | CONFIRMATION, REMINDER_2_DAYS, REMINDER_1_DAY, LAST_ATTEMPT |

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| RN01_VIOLATION | Violação de regra de negócio (dados duplicados) |

---

## Exemplos

### Dashboard - Resumo de Leads
```graphql
query DashboardStats {
  leads(first: 100) {
    totalCount
    edges {
      node {
        status
        origin
      }
    }
  }
  appointments(status: SCHEDULED) {
    id
    scheduledAt
  }
  surgeons {
    id
    name
    specialty
  }
}
```

# Banco de Dados

O CRMed utiliza **PostgreSQL** como banco de dados relacional primário, gerenciado através do **Prisma ORM**.

## Diagrama ER

```mermaid
erDiagram
    Lead ||--o| Patient : converts_to
    Lead ||--o{ Contact : has
    Patient ||--o{ Appointment : has
    Patient ||--o{ AuditLog : has
    Patient ||--o{ Budget : has
    Patient ||--o{ Complaint : has
    Patient ||--o{ Document : has
    Patient ||--o{ PostOp : has
    Surgeon ||--o{ Appointment : performs
    Surgeon ||--o{ AvailabilitySlot : defines
    Surgeon ||--o{ ExtraAvailabilitySlot : has
    Surgeon ||--o{ ScheduleBlock : has
    Appointment ||--o{ AuditLog : has
    Appointment ||--o{ Notification : triggers
    User ||--o{ AuditLog : performs

    Lead {
        string id PK
        string name
        string email
        string phone
        string status
        datetime deletedAt
    }
    Patient {
        string id PK
        string leadId FK
        datetime dateOfBirth
        string medicalRecord
    }
    Appointment {
        string id PK
        string patientId FK
        string surgeonId FK
        datetime scheduledAt
        string status
        int riskScore
        string riskLevel
    }
    Surgeon {
        string id PK
        string name
        string crm
    }
    User {
        string id PK
        string email
        string role
    }
```

## Entidades Críticas

### Appointment (Agendamento)
Entidade central para a operação da clínica. Armazena o estado do atendimento e o **No-Show Risk Score**.
- `riskScore`: Valor de 0 a 100 indicando probabilidade de comparecimento.
- `riskLevel`: Classificação (LOW, MEDIUM, HIGH).

### Lead
Armazena potenciais pacientes. O campo `status` segue o fluxo `NEW` → `CONTACTED` → `QUALIFIED` → `CONVERTED`.

### AuditLog
Implementa a **RN06**, registrando cada alteração crítica no sistema, incluindo quem alterou, o valor antigo e o novo valor.

## Decisões de Modelagem

1. **Soft Delete**: Utilizado em `Lead` e `Patient` para manter integridade histórica e cumprir requisitos de LGPD (recuperação de dados).
2. **Enums**: Todos os estados (Status, Roles, Tipos) são definidos via Enums no Prisma para garantir consistência em nível de banco de dados.
3. **Indexação**: Índices adicionados em campos de busca frequente (`cpf`, `email`, `status`, `scheduledAt`) para otimizar performance.

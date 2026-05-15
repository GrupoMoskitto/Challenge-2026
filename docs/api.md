# API Reference (GraphQL)

O CRMed expõe uma API GraphQL para comunicação entre o Frontend e o Backend.

## Queries Principais

### `appointments(status: AppointmentStatus, riskLevel: RiskLevel): [Appointment!]!`
Retorna a lista de agendamentos com filtros opcionais.
- **Roles**: ADMIN, RECEPTION, CALL_CENTER (filtros limitados para SURGEON).

### `leads(search: String, status: LeadStatus): LeadConnection!`
Retorna leads paginados.
- **Filtros**: Busca por nome/CPF e status do funil.

### `performanceMetrics(startDate: DateTime, endDate: DateTime): PerformanceMetrics!`
KPIs para o dashboard.

## Mutations Principais

### `recalculateRiskScore(appointmentId: ID!): Appointment!`
Força o recálculo do score de risco de um agendamento.
- **Roles**: ADMIN, RECEPTION, CALL_CENTER.

### `updateAppointmentStatus(input: UpdateAppointmentStatusInput!): Appointment!`
Altera o status de um agendamento e dispara o recálculo do risco.

### `convertLeadToPatient(input: ConvertLeadInput!): Patient!`
Cria um paciente a partir de um lead qualificado.

## Enums

### AppointmentStatus
- `SCHEDULED`: Agendado.
- `CONFIRMED`: Confirmado pelo paciente.
- `ATTENTION_REQUIRED`: SLA violado ou sinal de risco detectado.
- `COMPLETED`: Procedimento realizado.
- `CANCELLED`: Cancelado.
- `NO_SHOW`: Paciente não compareceu.

### RiskLevel
- `LOW`: Risco baixo.
- `MEDIUM`: Risco moderado.
- `HIGH`: Risco alto.

## Exemplos de Uso

### Buscar Agendamentos Críticos
```graphql
query GetCriticalAppointments {
  appointments(riskLevel: HIGH) {
    id
    scheduledAt
    riskScore
    patient {
      lead {
        name
      }
    }
  }
}
```

# API Reference (GraphQL)

O CRMed expõe uma API GraphQL via Apollo Server para toda a comunicação entre Frontend e Backend. O endpoint principal é `POST /graphql`.

## Autenticação

Todas as operações (exceto `login`) exigem um `access_token` válido transportado via **cookie HttpOnly**. O cliente web deve sempre usar `credentials: 'include'` nas chamadas Apollo:

```typescript
// Apollo Client — apps/web
new ApolloClient({
  uri: 'http://localhost:3001/graphql',
  credentials: 'include', // Envia cookies automaticamente
});
```

## Queries Principais

### `appointments(status, riskLevel, surgeonId, startDate, endDate)`
Retorna agendamentos com filtros opcionais.
- **Roles**: ADMIN, RECEPTION, SURGEON (visualiza apenas os próprios).

### `leads(search, status, first, after)`
Retorna leads paginados via cursor (Connection pattern).
- **Filtros**: Busca textual por nome/CPF e status do funil.

### `patients(search, first, after)`
Lista pacientes com busca integrada.
- **Roles**: ADMIN, SURGEON, RECEPTION.

### `performanceMetrics(startDate, endDate)`
KPIs consolidados para o dashboard (taxa de conversão, score médio, etc.).
- **Roles**: ADMIN.

### `dashboardStats`
Dados em tempo real do painel: agendamentos do dia, pacientes críticos, score hospitalar.

---

## Mutations Principais

### Auth

| Mutation | Descrição |
| :--- | :--- |
| `login(email, password)` | Autentica o usuário e seta cookies `access_token` + `refresh_token`. |
| `logout` | Limpa os cookies de sessão. |

### Leads

| Mutation | Descrição |
| :--- | :--- |
| `createLead(input)` | Cria um lead manualmente. Aplica RN01 (unicidade de CPF/email). |
| `updateLeadStatus(id, status)` | Avança o lead no funil de vendas. |
| `importLeads(fileUrl)` | Importa leads em lote via CSV. Usa `upsert` para respeitar RN01. |
| `convertLeadToPatient(input)` | Cria a entidade `Patient` a partir de um lead qualificado. Exige CPF e telefone (RN02). |

### Agendamentos

| Mutation | Descrição |
| :--- | :--- |
| `createAppointment(input)` | Cria agendamento. Valida conflito de horário (RN04) e horário de expediente (RN08). |
| `updateAppointmentStatus(input)` | Altera status e dispara recálculo do Risk Score. Registra AuditLog (RN06). |
| `recalculateRiskScore(appointmentId)` | Força recálculo manual do score de risco. |

### Usuários e Cirurgiões

| Mutation | Descrição |
| :--- | :--- |
| `createSurgeon(input)` | Cria User (role: SURGEON) + Surgeon em uma única transação. **Roles**: ADMIN. |
| `toggleUserStatus(userId)` | Ativa/desativa usuário. Revoga tokens imediatamente via Redis. **Roles**: ADMIN. |

---

## Paginação (Connection Pattern)

Todas as queries que retornam listas usam o padrão Cursor-based Pagination:

```graphql
type LeadConnection {
  edges: [LeadEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type LeadEdge {
  node: Lead!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}
```

**Uso no frontend:**
```typescript
data?.leads?.edges?.map((edge) => edge.node)
```

---

## Enums

### AppointmentStatus
| Valor | Descrição |
| :--- | :--- |
| `SCHEDULED` | Agendado, aguardando confirmação. |
| `CONFIRMED` | Confirmado pelo paciente via WhatsApp. |
| `ATTENTION_REQUIRED` | SLA de 24h violado ou risco detectado. |
| `COMPLETED` | Procedimento realizado com sucesso. |
| `CANCELLED` | Cancelado pelo paciente ou pela clínica. |
| `NO_SHOW` | Paciente não compareceu. |

### LeadStatus
`NEW` → `CONTACTED` → `QUALIFIED` → `CONVERTED` | `LOST`

### RiskLevel
`LOW` (score ≥ 80) | `MEDIUM` (50–79) | `HIGH` (< 50)

---

## Exemplos de Uso

### Login e Acesso Seguro
```graphql
mutation Login {
  login(email: "admin@crmed.com", password: "...") {
    user {
      id
      email
      role
    }
  }
}
# Resposta: Set-Cookie: access_token=...; HttpOnly; Secure
```

### Buscar Agendamentos de Alto Risco
```graphql
query GetCriticalAppointments {
  appointments(riskLevel: HIGH) {
    id
    scheduledAt
    riskScore
    riskLevel
    status
    patient {
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
```

### Importar Leads via CSV
```graphql
mutation ImportLeads {
  importLeads(fileUrl: "/api/uploads/1234567890-leads.csv") {
    imported
    skipped
    errors {
      row
      reason
    }
  }
}
```

---

## Erros e Códigos

| Código | Situação |
| :--- | :--- |
| `UNAUTHENTICATED` | Token ausente ou expirado. Redirecionar para login. |
| `FORBIDDEN` | Role não possui permissão para a operação. |
| `RATE_LIMITED` | Limite de requisições excedido (HTTP 429). |
| `RN01_VIOLATION` | Duplicidade de CPF ou email detectada. |
| `RN03_VIOLATION` | Role não autorizado a alterar para este status. |
| `RN04_VIOLATION` | Conflito de horário na agenda do cirurgião. |
| `VALIDATION_ERROR` | Input inválido (enum, formato de data, etc.). |

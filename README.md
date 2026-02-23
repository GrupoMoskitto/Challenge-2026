# CRMed - Sistema Inteligente de Relacionamento e Performance Clínica

O **CRMed** é uma solução interna desenvolvida para o **Hospital São Rafael** (especializado em cirurgias eletivas e plásticas), com o objetivo de centralizar a jornada do paciente e automatizar processos que hoje dependem de múltiplas ferramentas manuais.

## Escopo do Produto

O sistema atua como o cérebro operacional do hospital, gerenciando desde a entrada do lead até o acompanhamento pós-operatório, garantindo eficiência para as equipes de Call Center, Vendas e Recepção.

### Funcionalidades Principais

- **Centralização de Leads:** Captura automática de redes sociais e canais digitais.
- **Gestão de Agendas:** Controle em tempo real da disponibilidade dos cirurgiões.
- **Automação de Contatos:** Disparos automáticos via WhatsApp para confirmações e lembretes.
- **Inteligência de Dados:** Dashboards de conversão e ociosidade médica.

### Escopo Externo

- Não substitui o ERP completo (Tasy).
- Não realiza processamento de pagamentos diretamente.
- Não é uma interface voltada para o paciente final (contato apenas via WhatsApp).

## Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Backend** | Node.js + TypeScript |
| **API** | GraphQL & RESTful API |
| **Frontend** | React / Next.js (Interface Interna) |
| **Banco de Dados** | PostgreSQL + Prisma ORM |
| **Mensageria/Jobs** | Redis + BullMQ |
| **WhatsApp** | Evolution API + Typebot |
| **Infraestrutura** | Docker & LocalStack (Simulação AWS) |
| **Autenticação** | Clerk / Auth0 |

## Arquitetura do Projeto

Estrutura monorepo com pnpm workspaces e Turbo para orquestração de builds:

```
apps/
├── api/              # Backend Node.js (GraphQL/REST) - Processa leads e agendamentos
├── web/              # Next.js Dashboard Interno - Interface para colaboradores e médicos
├── workers/          # BullMQ Workers - Processamento de filas (RN05)

functions/
├── pdf-generator/    # Lambda - Gera contratos e orçamentos PDF
├── lead-webhook/     # Lambda - Captura leads das redes sociais

packages/
├── config/           # Configurações compartilhadas (ESLint, Prettier, TSConfig)
├── database/         # Prisma ORM - Schema, migrations e cliente compartilhado
├── types/            # Tipos TypeScript compartilhados
├── ui/               # Biblioteca de componentes React

infra/
├── docker/           # Dockerfiles e Docker Compose
└── localstack/       # Scripts de inicialização S3/SES
```

### Banco de Dados Centralizado

O pacote `@crmed/database` garante a **RN01 - Duplicidade Zero**:
- Constraint `@unique` em CPF, e-mail e telefone
- Função helper `checkUniqueness()` exportada para todos os projetos
- Backend, Lambdas e Workers compartilham o mesmo Prisma Client

## Regras de Negócio Críticas (RNs)

Para ter o sucesso do projeto, o código deve obrigatoriamente seguir estas diretrizes extraídas dos manuais operacionais:

| RN | Descrição | Prioridade |
| :--- | :--- | :--- |
| **RN01** | **Unicidade:** Proibido cadastrar pacientes ou leads com dados duplicados (CPF, e-mail ou telefone). | Crítica |
| **RN03** | **Hierarquia:** Mudanças de status crítico só podem ser realizadas por colaboradores autorizados via sistema. | Alta |
| **RN05** | **Ciclo de Notificações:** O envio de mensagens via WhatsApp deve seguir a cronologia exata: | Crítica |
| | • 4 dias antes da consulta (Mensagem de confirmação) | |
| | • 2 dias antes (Lembrete) | |
| | • 1 dia antes (Ligação/Mensagem para não confirmados) | |
| | • Dia da consulta (Última tentativa) | |
| **RN06** | **Registro de Auditoria:** Todas as tentativas de contato e alterações de status devem ser logadas com data, hora e responsável. | Alta |

## Configuração de Desenvolvimento

### Pré-requisitos

- Docker e Docker Compose instalados.
- Node.js v20+.
- pnpm v10+.

### Instalação

1. Clone o repositório.
2. Configure o arquivo `.env`:
   ```bash
   cp packages/database/.env.example packages/database/.env
   ```
3. Instale as dependências:
   ```bash
   pnpm install
   ```
4. Gere o Prisma Client:
   ```bash
   pnpm --filter @crmed/database db:generate
   ```
5. Suba a infraestrutura com Docker Compose:
   ```bash
   cd infra/docker && docker-compose up -d
   ```
6. Execute as migrações do banco de dados:
   ```bash
   pnpm --filter @crmed/database db:migrate
   ```

### Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `pnpm dev` | Inicia todos os projetos em modo desenvolvimento |
| `pnpm build` | Build de todos os projetos |
| `pnpm --filter @crmed/api dev` | Inicia apenas a API |
| `pnpm --filter @crmed/web dev` | Inicia apenas o frontend |
| `pnpm --filter @crmed/workers dev` | Inicia apenas os workers |
| `pnpm infra:up` | Sobe containers Docker |
| `pnpm infra:down` | Para containers Docker |

### Variáveis de Ambiente

| Variável | Descrição |
| :--- | :--- |
| `DATABASE_URL` | String de conexão PostgreSQL |
| `REDIS_URL` | String de conexão Redis |
| `LOCALSTACK_URL` | URL do LocalStack (desenvolvimento) |
| `CLERK_SECRET_KEY` | Chave do Clerk para autenticação |
| `EVOLUTION_API_KEY` | Chave da Evolution API |

## API GraphQL

O projeto utiliza **Apollo Server** para a API GraphQL.

### Iniciar a API

```bash
pnpm --filter @crmed/api dev
```

A API estará disponível em: `http://localhost:3001`

### Playground GraphQL

Acesse o GraphQL Playground em: `http://localhost:3001/graphql`

### Padrões de Resposta

A API segue padrões de mercado profissionais:

| Recurso | Formato |
| :--- | :--- |
| **IDs** | Base64 URL-safe (ex: `Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ`) |
| **Datas** | ISO 8601 (ex: `2026-02-23T01:42:12.245Z`) |
| **Listas** | Paginação cursor-based com PageInfo |

### Estrutura de Resposta com Paginação

```graphql
{
  "leads": {
    "edges": [
      {
        "node": { ... },
        "cursor": "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ"
      }
    ],
    "pageInfo": {
      "hasNextPage": true,
      "hasPreviousPage": false,
      "startCursor": "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ",
      "endCursor": "Y21seWk4a202MDAwMHowNW04b3NnZjFzZA"
    },
    "totalCount": 42
  }
}
```

### Queries

```graphql
# Listar leads com paginação
query GetLeads {
  leads(first: 10) {
    edges {
      node {
        id
        name
        email
        phone
        cpf
        source
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

# Paginação - buscar próxima página
query GetNextPage {
  leads(first: 10, after: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ") {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
    }
  }
}

# Filtrar leads por status
query GetLeadsByStatus {
  leads(status: NEW, first: 5) {
    edges {
      node {
        id
        name
        status
      }
    }
  }
}

# Buscar lead por ID (use o ID base64)
query GetLead {
  lead(id: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ") {
    id
    name
    email
    phone
    status
    createdAt
    updatedAt
    patient {
      id
      dateOfBirth
      medicalRecord
    }
  }
}

# Buscar lead por CPF
query GetLeadByCpf {
  leadByCpf(cpf: "12345678900") {
    id
    name
    status
  }
}

# Listar pacientes
query GetPatients {
  patients {
    id
    name
    dateOfBirth
    medicalRecord
    lead {
      name
      email
    }
  }
}

# Listar cirurgiões ativos
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

# Listar agendamentos
query GetAppointments {
  appointments(status: SCHEDULED) {
    id
    procedure
    scheduledAt
    status
    notes
    patient {
      id
      name
    }
    surgeon {
      id
      name
    }
  }
}

# Listar usuários
query GetUsers {
  users {
    id
    name
    email
    role
    isActive
  }
}

# Listar logs de auditoria
query GetAuditLogs {
  auditLogs(entityType: "Lead", entityId: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ") {
    id
    action
    oldValue
    newValue
    reason
    createdAt
  }
}
```

### Mutations

```graphql
# Criar lead
mutation CreateLead {
  createLead(input: {
    name: "João Silva"
    email: "joao@email.com"
    phone: "11999999999"
    cpf: "12345678900"
    source: "Instagram"
  }) {
    id
    name
    email
    status
    createdAt
    updatedAt
  }
}

# Atualizar status do lead
mutation UpdateLeadStatus {
  updateLeadStatus(input: {
    id: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ"
    status: CONTACTED
    reason: "Contato realizado com sucesso"
  }) {
    id
    status
    updatedAt
  }
}

# Criar paciente (após conversão do lead)
mutation CreatePatient {
  createPatient(input: {
    leadId: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ"
    dateOfBirth: "1990-05-15T00:00:00.000Z"
    medicalRecord: "PRONT-001"
  }) {
    id
    dateOfBirth
    medicalRecord
  }
}

# Criar agendamento
mutation CreateAppointment {
  createAppointment(input: {
    patientId: "Y21seWloZDA1MDAwMDEybTBhdjQxdmY5NQ"
    surgeonId: "Y21seWs4a202MDAwMHowNW04b3NnZjFzZA"
    procedure: "Cirurgia Plástica"
    scheduledAt: "2026-03-15T14:00:00.000Z"
    notes: "Paciente chegou pelo Instagram"
  }) {
    id
    status
    scheduledAt
    createdAt
  }
}

# Atualizar status do agendamento
mutation UpdateAppointmentStatus {
  updateAppointmentStatus(input: {
    id: "Y21seWE1cHTUwMDAwMDF2bTBhdjQxdmY5NQ"
    status: CONFIRMED
    reason: "Paciente confirmou presença"
  }) {
    id
    status
    updatedAt
  }
}

# Criar cirurgião
mutation CreateSurgeon {
  createSurgeon(input: {
    name: "Dr. Carlos Santos"
    specialty: "Cirurgia Plástica"
    crm: "123456-SP"
    email: "carlos@hospital.com"
    phone: "11988887777"
  }) {
    id
    name
    specialty
    crm
    createdAt
  }
}

# Criar usuário do sistema
mutation CreateUser {
  createUser(input: {
    name: "Maria Silva"
    email: "maria@hospital.com"
    role: CALL_CENTER
  }) {
    id
    name
    email
    role
    createdAt
  }
}
```

### Enums Disponíveis

```graphql
# LeadStatus
NEW, CONTACTED, QUALIFIED, CONVERTED, LOST

# AppointmentStatus
SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW

# UserRole
ADMIN, SURGEON, CALL_CENTER, RECEPTION, SALES

# NotificationType
CONFIRMATION, REMINDER_2_DAYS, REMINDER_1_DAY, LAST_ATTEMPT
```

### Schema GraphQL

O schema inclui os seguintes tipos principais:
- **Lead** - Potenciais pacientes
- **Patient** - Pacientes cadastrados (após conversão)
- **Surgeon** - Cirurgiões do hospital
- **Appointment** - Agendamentos de cirurgias
- **User** - Usuários do sistema (admin, call center, recepção, etc.)
- **AuditLog** - Logs de auditoria (RN06)
- **Notification** - Notificações de lembretes

### Portas dos Serviços

| Serviço | Porta |
| :--- | :--- |
| API GraphQL | 3001 |
| Web (Next.js) | 3000 |
| Workers | 3002 |

---

Projeto desenvolvido pelo Grupo Moskitto para o Challenge FIAP / Hospital São Rafael.
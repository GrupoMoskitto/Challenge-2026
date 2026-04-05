<h1 align="center">
  <img src="assets/logo.svg" alt="" width="64" valign="middle">&nbsp;CRMed
</h1>
<p align="center">Sistema inteligente de relacionamento e performance clínica para o Hospital São Rafael.</p>
<p align="center">
  <a href="https://github.com/GrupoMoskitto/Challenge-2026/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/GrupoMoskitto/Challenge-2026/ci.yml?style=flat&branch=main&label=CI&logo=githubactions&logoColor=white" /></a>&nbsp;
  <a href="https://github.com/GrupoMoskitto/Challenge-2026"><img alt="Node" src="https://img.shields.io/badge/node-v24-339933?style=flat&logo=nodedotjs&logoColor=white" /></a>&nbsp;
  <a href="https://github.com/GrupoMoskitto/Challenge-2026"><img alt="pnpm" src="https://img.shields.io/badge/pnpm-v10-F69220?style=flat&logo=pnpm&logoColor=white" /></a>&nbsp;
  <a href="https://github.com/GrupoMoskitto/Challenge-2026"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat&logo=typescript&logoColor=white" /></a>
</p>

<br>

[![CRMed — Hospital São Rafael](assets/app.png)](https://github.com/GrupoMoskitto/Challenge-2026)

---

### Sobre

O **CRMed** é o cérebro operacional do **Hospital São Rafael** (especializado em cirurgias eletivas e plásticas). Centraliza a jornada do paciente — da entrada do lead ao acompanhamento pós-operatório — automatizando processos que antes dependiam de múltiplas ferramentas manuais.

**Funcionalidades principais:**

- **Centralização de Leads** — Captura automática de redes sociais e canais digitais
- **Gestão de Agendas** — Controle em tempo real da disponibilidade dos cirurgiões
- **Automação WhatsApp** — Disparos automáticos para confirmações e lembretes (RN05)
- **Inteligência de Dados** — Dashboards de conversão, performance e ociosidade médica
- **Import/Export** — Importação e exportação de leads via CSV
- **Auditoria Completa** — Rastreabilidade total de ações e alterações (RN06)

### Stack

| Camada | Tecnologia |
| --- | --- |
| **Backend** | Node.js · TypeScript · GraphQL (Apollo Server) |
| **Frontend** | React · Vite · Tailwind CSS · Radix UI · shadcn/ui |
| **Banco de Dados** | PostgreSQL · Prisma ORM |
| **Mensageria / Jobs** | Redis · BullMQ · Cron |
| **WhatsApp** | Evolution API (Baileys) |
| **Infra** | Docker |
| **Autenticação** | JWT (jsonwebtoken · bcryptjs) |
| **Testes** | Vitest · Testing Library |

### Arquitetura

Monorepo com **pnpm workspaces** e **Turborepo**:

```
apps/
├── api/              # Backend GraphQL/REST (Apollo Server)
├── web/              # Dashboard interno (React + Vite)
├── workers/          # BullMQ Workers (RN05 — lembretes WhatsApp)

functions/
├── pdf-generator/    # Lambda — contratos e orçamentos PDF
├── lead-webhook/     # Lambda — captura de leads

packages/
├── config/           # ESLint, Prettier, TSConfig compartilhados
├── database/         # Prisma — schema, migrations, client
├── types/            # Tipos TypeScript compartilhados
├── ui/               # Biblioteca de componentes React

infra/
└── docker/           # Dockerfiles, Docker Compose e Evolution API
```

### Documentação Visual

#### Diagrama ER do Banco de Dados

```mermaid
erDiagram
    USER {
        string id PK
        string email
        string role
        boolean isActive
    }

    LEAD {
        string id PK
        string name
        string email
        string phone
        string cpf
        string status
    }

    PATIENT {
        string id PK
        string leadId FK
        string medicalRecord
    }

    SURGEON {
        string id PK
        string name
        string specialty
        string crm
    }

    APPOINTMENT {
        string id PK
        string patientId FK
        string surgeonId FK
        datetime scheduledAt
        string status
    }

    CONTACT {
        string id PK
        string leadId FK
        string type
        string status
    }

    AUDIT_LOG {
        string id PK
        string entityType
        string action
        string userId FK
        datetime createdAt
    }

    NOTIFICATION {
        string id PK
        string appointmentId FK
        string type
        string status
    }

    DOCUMENT {
        string id PK
        string patientId FK
        string type
        string status
    }

    POST_OP {
        string id PK
        string patientId FK
        string type
        string status
    }

    AVAILABILITY_SLOT {
        string id PK
        string surgeonId FK
        int dayOfWeek
        string startTime
        string endTime
    }

    MESSAGE_TEMPLATE {
        string id PK
        string name
        string channel
        int triggerDays
    }

    LEAD ||--o| PATIENT : converte_em
    LEAD ||--o{ CONTACT : possui
    LEAD ||--o{ APPOINTMENT : origina
    SURGEON ||--o{ APPOINTMENT : realiza
    SURGEON ||--o{ AVAILABILITY_SLOT : agenda
    PATIENT ||--o{ DOCUMENT : possui
    PATIENT ||--o{ POST_OP : acompanha
    USER ||--o{ AUDIT_LOG : registra
    APPOINTMENT ||--o{ AUDIT_LOG : audita
    APPOINTMENT ||--o{ NOTIFICATION : gera
```
> [!NOTE]
> O diagrama resume a modelagem atual do [`schema.prisma`](packages/database/prisma/schema.prisma) e prioriza legibilidade visual.

### Quick Start

```bash
# Clone
git clone https://github.com/GrupoMoskitto/Challenge-2026.git
cd Challenge-2026

# Configure (arquivo central na raiz)
cp .env.example .env
  
# Instale e inicie tudo
npm install --global pnpm
pnpm install
pnpm infra:dev
```

> [!TIP]
> O comando `pnpm infra:dev` automatiza **todo** o setup: Docker, banco de dados com seed, Evolution API (WhatsApp) e todos os apps em paralelo. A variável `DEV_ALLOWED_PHONE` no arquivo `.env` da raiz restringe **todas** as mensagens apenas ao número definido em dev (sandbox mode).

### Instalação Manual

<details>
<summary>Passo a passo</summary>

1. **Dependências:** `npm install --global pnpm && pnpm install`
2. **Docker:** `pnpm infra:up` (PostgreSQL, Redis, Evolution API)
3. **Banco:** `pnpm --filter @crmed/database db:setup`
4. **Apps:** `pnpm dev`

</details>

### Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia todos os projetos em modo dev |
| `pnpm build` | Build de todos os projetos |
| `pnpm infra:up` | Sobe containers Docker (PostgreSQL, Redis, Evolution API) |
| `pnpm infra:down` | Para containers Docker |
| `pnpm infra:dev` | **Setup completo**: Docker + seed + dev |
| `pnpm --filter @crmed/api dev` | Inicia apenas a API |
| `pnpm --filter @crmed/web dev` | Inicia apenas o frontend |
| `pnpm --filter @crmed/workers dev` | Inicia apenas os workers |

### Portas

| Serviço | Porta |
| --- | --- |
| Web (Frontend) | `3000` |
| API GraphQL | `3001` |
| Workers | `3002` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| Evolution API | `8080` |

### Regras de Negócio

| RN | Descrição | Prioridade |
| --- | --- | --- |
| **RN01** | **Duplicidade Zero** — Proibido cadastrar pacientes com CPF, e-mail ou telefone duplicados | Crítica |
| **RN03** | **Hierarquia** — Mudanças de status crítico exigem autorização por role | Alta |
| **RN05** | **Ciclo de Notificações** — WhatsApp: 4d, 2d, 1d antes e dia da consulta | Crítica |
| **RN06** | **Auditoria** — Toda tentativa de contato e alteração logada com data/hora/responsável | Alta |

### Variáveis de Ambiente

O projeto utiliza um arquivo central `.env.example` na raiz do repositório. Copie-o para `.env` e preencha os valores:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL |
| `REDIS_URL` | Conexão Redis (BullMQ / State) |
| `EVOLUTION_API_KEY` | Chave da Evolution API |
| `EVOLUTION_API_URL` | URL da Evolution API (padrão: `http://localhost:8080`) |
| `EVOLUTION_INSTANCE_NAME` | Instância para lembretes automáticos |
| `DEV_ALLOWED_PHONE` | **Sandbox** — Restringe mensagens a este nº em dev |

> [!IMPORTANT]
> **Sandbox Mode:** O número configurado em `DEV_ALLOWED_PHONE` é usado para **todos** os testes de envio. O diálogo de "Teste de Disparo" mostra os últimos 4 dígitos do número configurado.

---

### API GraphQL

A API estará disponível em `http://localhost:3001/graphql` após iniciar o projeto.

<details>
<summary><strong>Queries</strong></summary>

```graphql
# Dashboard
query GetDashboardStats {
  leads { totalCount edges { node { id status origin createdAt } } }
  appointments(status: SCHEDULED) { id scheduledAt procedure patient { name } surgeon { name } }
  surgeons { id name specialty }
}

# Performance Metrics
query GetPerformanceMetrics($startDate: DateTime, $endDate: DateTime) {
  performanceMetrics(startDate: $startDate, endDate: $endDate) {
    avgFirstContactTime
    avgConversionTime
    avgSchedulingTime
    responseRate
    totalContacts
    totalConversions
    leadsByDay { date count converted }
    conversionFunnel { status count }
  }
}

# Leads com paginação
query GetLeads($status: LeadStatus, $first: Int, $after: String) {
  leads(status: $status, first: $first, after: $after) {
    edges { node { id name email phone cpf status createdAt } cursor }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}

# Pacientes
query GetPatients {
  patients { id dateOfBirth medicalRecord lead { id name email phone cpf status } }
}

# Paciente com campos extendidos
mutation CreatePatient($input: CreatePatientInput!) {
  createPatient(input: $input) {
    id dateOfBirth medicalRecord
    sex weight height howMet  # Campos novos
  }
}

# Cirurgiões
query GetSurgeons {
  surgeons { id name specialty crm email phone isActive availability { dayOfWeek startTime endTime } }
}

# Agendamentos
query GetAppointments($status: AppointmentStatus) {
  appointments(status: $status) { id procedure scheduledAt status patient { name } surgeon { name } }
}

# Auditoria
query GetAuditLogs($entityType: String, $entityId: String) {
  auditLogs(entityType: $entityType, entityId: $entityId) { id action oldValue newValue reason createdAt user { name } }
}
```

</details>

<details>
<summary><strong>Mutations</strong></summary>

```graphql
# Leads
mutation CreateLead($input: CreateLeadInput!) { createLead(input: $input) { id name status createdAt } }
mutation UpdateLeadStatus($input: UpdateLeadStatusInput!) { updateLeadStatus(input: $input) { id status } }
mutation DeleteLead($id: ID!) { deleteLead(id: $id) { success message } }
mutation ExportLeads($format: String) { exportLeads(format: $format) }
mutation ImportLeads($csvContent: String!) { importLeads(csvContent: $csvContent) { success imported errors } }

# Pacientes
mutation CreatePatient($input: CreatePatientInput!) { createPatient(input: $input) { id dateOfBirth medicalRecord } }

# Agendamentos
mutation CreateAppointment($input: CreateAppointmentInput!) { createAppointment(input: $input) { id procedure scheduledAt status } }
mutation UpdateAppointmentStatus($input: UpdateAppointmentStatusInput!) { updateAppointmentStatus(input: $input) { id status } }

# Cirurgiões
mutation CreateSurgeon($input: CreateSurgeonInput!) { createSurgeon(input: $input) { id name specialty crm } }

# Contatos
mutation CreateContact($input: CreateContactInput!) { createContact(input: $input) { id type direction status message } }
```

</details>

<details>
<summary><strong>Enums</strong></summary>

```graphql
LeadStatus:        NEW · CONTACTED · QUALIFIED · CONVERTED · LOST
AppointmentStatus: SCHEDULED · CONFIRMED · COMPLETED · CANCELLED · NO_SHOW
UserRole:          ADMIN · SURGEON · CALL_CENTER · RECEPTION · SALES
ContactType:       WHATSAPP · CALL · EMAIL
ContactDirection:  INBOUND · OUTBOUND
ContactStatus:     READ · DELIVERED · SENT · ANSWERED · FAILED · MISSED
DocumentType:      CONTRACT · TERM · EXAM · OTHER
DocumentStatus:    PENDING · SIGNED · UPLOADED
PostOpType:        RETURN · FOLLOW_UP
PostOpStatus:      SCHEDULED · COMPLETED · CANCELLED
```

</details>

---

### WhatsApp — Evolution API

A automação de mensagens (RN05) usa a [Evolution API](https://github.com/EvolutionAPI/evolution-api) rodando via **Docker** (`evoapicloud/evolution-api:homolog`). O container sobe automaticamente com `pnpm infra:up`.

<details>
<summary><strong>Como conectar via QR Code</strong></summary>

Se `pnpm infra:dev` está rodando, a Evolution API já está ativa na porta `8080`.

**Via Manager UI (recomendado):**
1. Acesse `http://localhost:8080/manager`
2. Login com API Key: `crmed_evolution_api_token_123`
3. Crie ou selecione a instância `crmed-whatsapp`
4. Clique em **"Get QR Code"** e escaneie com o WhatsApp

**Via curl:**

```bash
# Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: crmed_evolution_api_token_123" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"crmed-whatsapp","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'

# Verificar conexão
curl http://localhost:8080/instance/connectionState/crmed-whatsapp \
  -H "apikey: crmed_evolution_api_token_123"
```

</details>

> [!IMPORTANT]
> **Sandbox Mode:** A variável `DEV_ALLOWED_PHONE` restringe **todas** as mensagens apenas ao número definido em dev. Mensagens bloqueadas são logadas como `[INFO] [WhatsApp] Mensagem bloqueada para ...XXXX (sandbox ativo)`.

### Workers e Logger

Os workers utilizam um **logger estruturado** (`apps/workers/src/config/logger.ts`) que exibe logs limpos e coloridos:

```
[12:30:00] [OK] [WhatsApp] Mensagem enviada para 551196325xxxx
[12:30:01] [INFO] [Worker] Processando job abc123: send-reminder
[12:30:02] [ERR] [Chatbot] Erro processando mensagem de João
```

A Evolution API sobe em segundo plano e sem stream de logs no terminal local; a observabilidade do fluxo fica concentrada nos `workers`, que fazem a filtragem de forma mais limpa.

---

### CI/CD e Testes

O pipeline GitHub Actions roda automaticamente a cada push:

- **Linting** — ESLint flat config para todo o monorepo
- **Testes** — Vitest validando RN01 (duplicidade), RN03 (hierarquia) e RN06 (auditoria)

---

### AGENTS.md

O projeto inclui um [`AGENTS.md`](AGENTS.md) — arquivo de instruções para **agentes de IA** (GitHub Copilot, Cursor, Gemini CLI). Ele contém o contexto completo do projeto, regras de negócio, padrões de código e diretrizes de segurança. Agentes compatíveis o detectam automaticamente na raiz do repositório.

---

### Contribuição

Veja o guia completo em [`CONTRIBUTING.md`](CONTRIBUTING.md) — branches, commits, testes e checklist de PR.

---

### Equipe

| Nome | GitHub | LinkedIn |
| --- | --- | --- |
| **Gabriel Couto Ribeiro** | [![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/rouri404) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/gabricouto/) |
| **Gabriel Kato Peres** | [![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/kato8088) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/gabrikato/) |
| **João Vitor de Matos** | [![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/joaomatosq) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/joaomatosq/) |
| **Marcelo Affonso Fonseca** | [![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/marcelo215) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/marcelo-affonso-fonseca-899682333/) |

---

<p align="center">
  Desenvolvido pelo <strong>Grupo Moskitto</strong> para o Challenge FIAP / Hospital São Rafael.
</p>

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
| **Frontend** | React + Vite (Interface Interna) |
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
├── evolution-api-local/ # Evolution API local (necessário para gerar QR Code)
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
7. Popule o banco com dados sintéticos:
   ```bash
   pnpm --filter @crmed/database db:seed
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
| `pnpm infra:postgres` | Inicia PostgreSQL via Docker |
| `pnpm infra:db:setup` | Sobe PostgreSQL + gera Prisma + executa migrações |
| `pnpm infra:whatsapp` | Inicia a Evolution API localmente (migra DB + sobe servidor) |
| `pnpm infra:dev` | Setup completo: Docker + seed + WhatsApp + dev em paralelo |

> **Recomendação:** Use `pnpm infra:dev` para subir tudo de uma vez (infra Docker, banco de dados com seed, Evolution API do WhatsApp e todos os apps em modo dev).


### Portas em Execução (Testes Locais)

| Serviço | Porta | Descrição |
| :--- | :--- | :--- |
| PostgreSQL | 5432 | Banco de dados principal |
| Redis | 6379 | Filas e cache |
| LocalStack | 4566 | Simulação AWS (S3, SES, Lambda) |
| API GraphQL | 3001 | Backend GraphQL/REST |
| API (Docker) | 3001 | API via Docker |
| Web | 3000 | Frontend Next.js |
| Workers | 3002 | BullMQ Workers |

### Variáveis de Ambiente

| Variável | Descrição |
| :--- | :--- |
| `DATABASE_URL` | String de conexão PostgreSQL |
| `REDIS_URL` | String de conexão Redis |
| `LOCALSTACK_URL` | URL do LocalStack (desenvolvimento) |
| `CLERK_SECRET_KEY` | Chave do Clerk para autenticação |
| `EVOLUTION_API_KEY` | Chave da Evolution API |

## API GraphQL

O projeto utiliza **Apollo Server** para a API GraphQL, fornecendo uma interface unificada para todas as operações do sistema.

### Iniciar a API

```bash
pnpm --filter @crmed/api dev
```

A API estará disponível em: `http://localhost:3001`

### Playground GraphQL

Acesse o GraphQL Playground em: `http://localhost:3001/graphql`

## Frontend

O frontend é uma aplicação React desenvolvida com Vite, fornecendo a interface interna para colaboradores e médicos do hospital.

### Iniciar o Frontend

```bash
pnpm --filter @crmed/web dev
```

O frontend estará disponível em: `http://localhost:3000`

### Funcionalidades Principais

- Dashboard com estatísticas e KPIs
- Gestão de leads e pacientes
- Agenda de consultas
- Configurações do sistema

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

### Queries Principais

<details>
<summary><strong>Dashboard e Estatísticas</strong></summary>

```graphql
# Estatísticas do dashboard (KPIs, leads, consultas)
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

# Consultas por data específica
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
```
</details>

<details>
<summary><strong>Gestão de Leads</strong></summary>

```graphql
# Listar leads com paginação e filtros
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

# Buscar lead específico por ID
query GetLead($id: ID!) {
  lead(id: $id) {
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
    contacts {
      id
      date
      type
      direction
      status
      message
    }
  }
}

# Buscar lead por CPF
query GetLeadByCpf($cpf: String!) {
  leadByCpf(cpf: $cpf) {
    id
    name
    email
    status
    createdAt
  }
}
```
</details>

<details>
<summary><strong>Gestão de Pacientes</strong></summary>

```graphql
# Listar todos os pacientes
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

# Buscar paciente específico
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
```
</details>

<details>
<summary><strong>Gestão de Cirurgiões</strong></summary>

```graphql
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
```
</details>

<details>
<summary><strong>Gestão de Agendamentos</strong></summary>

```graphql
# Listar agendamentos com filtros
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
```
</details>

<details>
<summary><strong>Gestão de Usuários</strong></summary>

```graphql
# Listar usuários do sistema
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

# Buscar usuário atual (autenticação)
query GetMe {
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
</details>

<details>
<summary><strong>Auditoria e Logs</strong></summary>

```graphql
# Logs de auditoria por entidade
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
    user {
      id
      name
    }
  }
}
```
</details>

<details>
<summary><strong>Templates de Mensagens</strong></summary>

```graphql
# Listar templates de mensagens automatizadas
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
</details>

### Mutations Principais

<details>
<summary><strong>Operações com Leads</strong></summary>

```graphql
# Criar novo lead
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

# Atualizar status do lead
mutation UpdateLeadStatus($input: UpdateLeadStatusInput!) {
  updateLeadStatus(input: $input) {
    id
    status
    updatedAt
  }
}

# Atualizar lead completo
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
    updatedAt
  }
}

# Excluir lead
mutation DeleteLead($id: ID!) {
  deleteLead(id: $id) {
    success
    message
  }
}
```
</details>

<details>
<summary><strong>Operações com Pacientes</strong></summary>

```graphql
# Criar paciente (conversão de lead)
mutation CreatePatient($input: CreatePatientInput!) {
  createPatient(input: $input) {
    id
    dateOfBirth
    medicalRecord
    address
  }
}

# Atualizar paciente
mutation UpdatePatient($input: UpdatePatientInput!) {
  updatePatient(input: $input) {
    id
    dateOfBirth
    medicalRecord
    address
  }
}
```
</details>

<details>
<summary><strong>Operações com Agendamentos</strong></summary>

```graphql
# Criar agendamento
mutation CreateAppointment($input: CreateAppointmentInput!) {
  createAppointment(input: $input) {
    id
    procedure
    scheduledAt
    status
  }
}

# Atualizar status do agendamento
mutation UpdateAppointmentStatus($input: UpdateAppointmentStatusInput!) {
  updateAppointmentStatus(input: $input) {
    id
    status
    updatedAt
  }
}

# Atualizar agendamento completo
mutation UpdateAppointment($input: UpdateAppointmentInput!) {
  updateAppointment(input: $input) {
    id
    procedure
    scheduledAt
    status
    notes
  }
}
```
</details>

<details>
<summary><strong>Operações com Cirurgiões</strong></summary>

```graphql
# Criar cirurgião
mutation CreateSurgeon($input: CreateSurgeonInput!) {
  createSurgeon(input: $input) {
    id
    name
    specialty
    crm
    email
    phone
    isActive
  }
}

# Atualizar cirurgião
mutation UpdateSurgeon($input: UpdateSurgeonInput!) {
  updateSurgeon(input: $input) {
    id
    name
    specialty
    crm
    email
    phone
    isActive
  }
}
```
</details>

<details>
<summary><strong>Operações com Usuários</strong></summary>

```graphql
# Criar usuário do sistema
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
    email
    role
    isActive
  }
}

# Atualizar usuário
mutation UpdateUser($input: UpdateUserInput!) {
  updateUser(input: $input) {
    id
    name
    email
    role
    isActive
  }
}
```
</details>

<details>
<summary><strong>Operações com Contatos</strong></summary>

```graphql
# Registrar contato com paciente
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    id
    date
    type
    direction
    status
    message
  }
}
```
</details>

### Enums Disponíveis

```graphql
# LeadStatus
NEW, CONTACTED, QUALIFIED, CONVERTED, LOST

# AppointmentStatus
SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW

# UserRole
ADMIN, SURGEON, CALL_CENTER, RECEPTION, SALES

# ContactType
WHATSAPP, CALL, EMAIL

# ContactDirection
INBOUND, OUTBOUND

# ContactStatus
READ, DELIVERED, SENT, ANSWERED, FAILED, MISSED

# DocumentType
CONTRACT, TERM, EXAM, OTHER

# DocumentStatus
PENDING, SIGNED, UPLOADED

# PostOpType
RETURN, FOLLOW_UP

# PostOpStatus
SCHEDULED, COMPLETED, CANCELLED
```

### Schema GraphQL

O schema inclui os seguintes tipos principais:
- **Lead** - Potenciais pacientes com dados de contato e status
- **Patient** - Pacientes cadastrados após conversão de leads
- **Surgeon** - Cirurgiões com especialidades e horários de disponibilidade
- **Appointment** - Agendamentos de cirurgias e consultas
- **User** - Usuários do sistema com diferentes roles de acesso
- **Contact** - Histórico de interações (WhatsApp, ligações, e-mails)
- **Document** - Documentos do paciente (contratos, exames, termos)
- **PostOp** - Acompanhamento pós-operatório
- **AuditLog** - Logs de auditoria para rastreabilidade (RN06)
- **MessageTemplate** - Templates para mensagens automatizadas
- **AvailabilitySlot** - Horários de disponibilidade dos cirurgiões

---

## Interface Frontend

O frontend é uma aplicação React desenvolvida com Vite, TypeScript e Tailwind CSS, oferecendo uma interface moderna e responsiva para os colaboradores do hospital.

### Principais Funcionalidades

- **Dashboard**: Visão geral com KPIs, gráficos de conversão e consultas agendadas
- **Gestão de Leads**: Sistema kanban para acompanhar o funil de vendas
- **Agenda Médica**: Controle de horários dos cirurgiões e agendamentos
- **Pacientes**: Visualização detalhada do histórico e acompanhamento
- **Configurações**: Gerenciamento de usuários e templates de mensagens

### Autenticação

Sistema de login seguro com JWT para controle de acesso baseado em roles (Admin, Cirurgião, Call Center, Recepção, Vendas).

## WhatsApp — Evolution API (RN05)

A automação de mensagens para a **RN05** (lembretes de consulta via WhatsApp) é feita através da [Evolution API](https://github.com/EvolutionAPI/evolution-api), rodando localmente fora do Docker para garantir compatibilidade com a versão mais recente do Baileys.

### Por que local e não Docker?

A imagem Docker oficial (`atendai/evolution-api:v2.x`) embute uma versão antiga do Baileys que não consegue gerar o QR Code porque o protocolo do WhatsApp foi atualizado. A solução é clonar o código-fonte e rodar com `npm` diretamente, garantindo a versão mais recente.

### Pré-requisito

A pasta `infra/evolution-api-local/` já está no repositório com o código clonado. Basta instalar as dependências:

```bash
cd infra/evolution-api-local
npm install
```

### 1. Migrar o banco `evolution`

*(Necessário apenas na primeira vez ou após limpar volumes)*

```bash
cd infra/evolution-api-local
npm run db:deploy
npm run db:generate
```

> Certifique-se que o Docker esteja rodando (`pnpm infra:up`) antes de executar o comando acima, pois ele precisa do PostgreSQL.

### 2. Iniciar a Evolution API

```bash
cd infra/evolution-api-local
npm run start:prod
```

A API sobe em `http://localhost:8080`. Logs ficam disponíveis no terminal.

### 3. Criar a instância e gerar o QR Code

**Via Manager UI (recomendado):**

1. Acesse `http://localhost:8080/manager`
2. Faça login com a API Key: `***REMOVED***`
3. Clique em **"+ Nova Instância"** ou selecione `crmed-whatsapp` caso já exista
4. Clique em **"Get QR Code"**
5. Escaneie com o WhatsApp no celular (**WhatsApp → Dispositivos conectados → Conectar dispositivo**)

**Via API (Postman/curl):**

```bash
# 1. Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: ***REMOVED***" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"crmed-whatsapp","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'

# 2. Aguardar ~5s e buscar o QR (retorna base64)
curl http://localhost:8080/instance/connect/crmed-whatsapp \
  -H "apikey: ***REMOVED***"
```

Cole o valor do campo `base64` em [base64.guru/converter/decode/image](https://base64.guru/converter/decode/image) para visualizar e escanear o QR.

### 4. Verificar conexão

```bash
curl http://localhost:8080/instance/connectionState/crmed-whatsapp \
  -H "apikey: ***REMOVED***"
# "status": "open" significa que está conectado!
```

### 5. Testar os Workers (RN05)

Com a instância conectada, inicie os workers para disparar os lembretes automáticos:

```bash
pnpm --filter @crmed/workers dev
```

O cron job roda diariamente às 08h verificando agendamentos que se encaixam nos critérios do RN05 (4, 2, 1 dias e no dia da consulta) e envia mensagens automaticamente via WhatsApp.

### Configuração (.env)

O arquivo `infra/evolution-api-local/.env` já está configurado para desenvolvimento local:

| Variável | Valor |
| :--- | :--- |
| `SERVER_URL` | `http://localhost:8080` |
| `AUTHENTICATION_API_KEY` | `***REMOVED***` |
| `DATABASE_CONNECTION_URI` | `postgresql://crmed:crmed123@localhost:5432/evolution` |
| `CACHE_REDIS_URI` | `redis://localhost:6379` |

### Adicionando à porta de serviços

| Serviço | Porta | Descrição |
| :--- | :--- | :--- |
| Evolution API | 8080 | WhatsApp Gateway (local, fora do Docker) |

---

## Integração Contínua (CI/CD) e Testes Automatizados


O projeto possui uma esteira de Integração Contínua (CI) configurada nativamente via **GitHub Actions**. A cada nova submissão de código, o pipeline assegura a qualidade da aplicação através das seguintes automações:

- **Padronização (Linting):** Validação estática rigorosa das sintaxes através do ESLint (em formato *flat config* que engloba todo o monorepo pnpm).
- **Testes de Unidade e Integração (Vitest):** Execução da suíte completa de testes do backend para garantir estabilidade à cada contribuição.

### Validação das Regras de Negócio Críticas (RNs)

A suíte de testes da API foi desenhada intencionalmente para assegurar o funcionamento das principais exigências operacionais do hospital:

- **RN01 - Duplicidade Zero:** Testes de rejeição que evitam o agrupamento de contatos ou CPFs idênticos, impedindo a inserção ou alteração conflitante na base de dados (`@crmed/database`).
- **RN03 - Hierarquia de Permissões:** Garantia de que atualizações transicionais nos fluxos (como os _status_ e as agendas) só aconteçam quando a *role* do usuário solicitante possuir de fato aquela permissão no GraphQL.
- **RN06 - Registro de Auditoria:** Mapeamento em bateria apontando que qualquer manipulação com os pacientes resulta numa adição inalterável nos históricos e *logs* provididos pelos _resolvers_.

---

## Regras de Contribuição

### Padrão de Commits
Siga o padrão *Semantic Commits*, baseando-se no histórico recente do projeto. Utilize os seguintes prefixos conforme a natureza da sua alteração:
- `feat`: Novas funcionalidades, implementações (ex: `feat(api): implement RN03 hierarchy constraints`)
- `fix`: Correções de bugs (ex: `fix(auth): prevent infinite redirect loop`)
- `docs`: Modificações na documentação (ex: `docs: adding ci/cd section`)
- `test`: Adição ou ajuste de testes (ex: `test(rns): add vitest and unit tests`)
- `chore`: Atualizações de ferramentas, configurações ou scripts (ex: `chore(eslint): setup monorepo linting flat config`)
- `ci`: Modificações voltadas para integração contínua (ex: `ci(github): setup continuous integration pipeline`)

### Padrão de Branch
Crie as branches a partir das tarefas do projeto, utilizando o prefixo `MOSK-` seguido do número da tarefa, o tipo do commit e o nome da feature em inglês com palavras separadas por hífen:
Formato: `MOSK-0000/tipo/tarefa-EM-INGLES`

Exemplos:
- `MOSK-0000/feat/add-login-screen`
- `MOSK-0012/fix/dashboard-chart-tooltip`

---

Projeto desenvolvido pelo Grupo Moskitto para o Challenge FIAP / Hospital São Rafael.
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

### Endpoints GraphQL

<details>
<summary>Ver exemplos de Queries e Mutations</summary>

**Queries:**
```graphql
# Listar leads (opcional: filtrar por status)
query GetLeads {
  leads(status: NEW) {
    id
    name
    email
    phone
    status
    createdAt
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

# Listar cirurgiões ativos
query GetSurgeons {
  surgeons {
    id
    name
    specialty
    crm
    availability {
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
    patient { name }
    surgeon { name }
  }
}
```

**Mutations:**
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
    status
  }
}

# Atualizar status do lead
mutation UpdateLeadStatus {
  updateLeadStatus(input: {
    id: "lead-id"
    status: CONTACTED
    reason: "Contato realizado com sucesso"
  }) {
    id
    status
  }
}

# Criar agendamento
mutation CreateAppointment {
  createAppointment(input: {
    patientId: "patient-id"
    surgeonId: "surgeon-id"
    procedure: "Cirurgia Plástica"
    scheduledAt: "2026-03-15T14:00:00Z"
    notes: "Paciente chegou pelo Instagram"
  }) {
    id
    status
    scheduledAt
  }
}

# Atualizar status do agendamento
mutation UpdateAppointmentStatus {
  updateAppointmentStatus(input: {
    id: "appointment-id"
    status: CONFIRMED
    reason: "Paciente confirmou presença"
  }) {
    id
    status
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
  }
}
```
</details>

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
# Guia de Desenvolvimento

Este guia fornece instruções para configurar o ambiente de desenvolvimento local do CRMed.

## Pré-requisitos

| Ferramenta | Versão | Finalidade |
| :--- | :--- | :--- |
| **Node.js** | v20+ (recomendado v24.13.1 conforme `.nvmrc`) | Runtime para API, Workers e build do Web. |
| **pnpm** | v9+ | Gerenciador de pacotes do monorepo. |
| **Docker & Docker Compose** | Qualquer versão recente | PostgreSQL e Redis em containers locais. |

## Quick Start

1. **Instalar dependências**:
   ```bash
   pnpm install
   ```

2. **Configurar Ambiente**:
   ```bash
   cp .env.example .env
   # Edite as variáveis no .env conforme necessário
   ```

3. **Subir Infraestrutura** (PostgreSQL + Redis):
   ```bash
   docker-compose up -d
   ```

4. **Preparar Banco de Dados**:
   ```bash
   pnpm --filter @crmed/database db:setup
   # Equivale a: db:generate + db:migrate + db:seed
   ```

5. **Iniciar em modo Dev** (todos os apps em paralelo):
   ```bash
   pnpm dev
   ```

## Scripts Principais

| Comando | Descrição |
| :--- | :--- |
| `pnpm dev` | Inicia todos os apps em modo watch (Web :5173, API :3001, Workers :3002). |
| `pnpm build` | Compila todos os pacotes e apps para produção. |
| `pnpm test` | Executa a suíte de testes (Vitest) em todo o monorepo. |
| `pnpm lint` | Executa o linter em todo o monorepo. |

## Tabela de Portas

| Serviço | Porta | Descrição |
| :--- | :--- | :--- |
| **Web App** | 5173 | Dashboard React (Vite Dev Server) |
| **API GraphQL** | 3001 | Apollo Server + Express |
| **Workers** | 3002 | BullMQ Processor + Webhook receiver |
| **PostgreSQL** | 5432 | Banco de dados principal |
| **Redis** | 6379 | Filas BullMQ + Token Blacklist + Rate Limit |

## Variáveis de Ambiente Críticas

| Variável | Obrigatória em Prod | Descrição |
| :--- | :--- | :--- |
| `DATABASE_URL` | ✅ | String de conexão com o PostgreSQL. |
| `REDIS_URL` | ✅ | String de conexão com o Redis. |
| `JWT_SECRET` | ✅ | Chave secreta para assinatura do `access_token` (15min). |
| `REFRESH_SECRET` | ✅ | Chave secreta para assinatura do `refresh_token` (7d). |
| `INTERNAL_API_KEY` | ✅ | Chave de autenticação interna Workers → API. Nunca expor publicamente. |
| `CORS_ORIGIN` | ✅ | Origens permitidas separadas por vírgula. Ex: `https://crmed.com`. |
| `EVOLUTION_INSTANCE_ID` | ✅ | ID da instância Evolution Go. |
| `EVOLUTION_API_KEY` | ✅ | API Key global da Evolution Go. |
| `DEV_ALLOWED_PHONE` | ❌ | Número autorizado a receber mensagens no Sandbox. **Deve estar vazio em produção.** |

> **Segurança**: Em produção, `JWT_SECRET` e `REFRESH_SECRET` lançam erro na inicialização caso não estejam definidos. Nunca use os valores padrão de desenvolvimento.

## Testes

O projeto utiliza **Vitest**.

- **Unitários**: Localizados junto ao código fonte (`*.test.ts`).
- **Integração**: Localizados em `__tests__` nos respectivos apps.

```bash
# Rodar todos os testes
pnpm test

# Testes da API com variáveis de auth (obrigatório)
JWT_SECRET=test-secret REFRESH_SECRET=test-refresh pnpm --filter @crmed/api test

# Teste específico por nome
pnpm --filter @crmed/api test -- --grep="RN01"

# Coverage
pnpm test -- --coverage
```

## Banco de Dados

```bash
# Setup completo (generate + migrate + seed)
pnpm --filter @crmed/database db:setup

# Apenas gerar o Prisma Client
pnpm --filter @crmed/database db:generate

# Apenas rodar migrações
pnpm --filter @crmed/database db:migrate

# Apenas popular com dados de seed
pnpm --filter @crmed/database db:seed
```

## Solução de Problemas Comuns

### Rate Limit 429 em Desenvolvimento
Os limiters de Rate Limit ignoram localhost automaticamente em modo `development`. Se mesmo assim receber 429, limpe o Redis:
```bash
redis-cli flushall
```

### Prisma Client Desatualizado
Após qualquer mudança no `schema.prisma`, regenere o client:
```bash
pnpm --filter @crmed/database db:generate
```

### Workers Não Conectam à API
Verifique se `INTERNAL_API_KEY` no `.env` corresponde ao valor esperado pela API. Os Workers usam este header para bypass de autenticação em operações internas.

### Timezone de Agendamentos
Todas as queries de data usam offset `-03:00` (America/Sao_Paulo). Se encontrar agendamentos sendo criados no dia errado, verifique se o `DATABASE_URL` não tem timezone forçado diferente.

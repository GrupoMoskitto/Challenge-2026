# Guia de Desenvolvimento

Este guia fornece instruções para configurar o ambiente de desenvolvimento local do CRMed.

## Pré-requisitos

- **Node.js**: v20+ (recomendado v24.13.1 conforme `.nvmrc`)
- **pnpm**: v9+
- **Docker & Docker Compose**: Para rodar o banco de dados e Redis localmente.

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

3. **Subir Infraestrutura**:
   ```bash
   docker-compose up -d
   ```

4. **Preparar Banco de Dados**:
   ```bash
   pnpm --filter @crmed/database db:migrate
   pnpm --filter @crmed/database db:seed
   ```

5. **Iniciar em modo Dev**:
   ```bash
   pnpm dev
   ```

## Scripts Principais

| Comando | Descrição |
| :--- | :--- |
| `pnpm dev` | Inicia todos os apps em modo watch (Vite, API, Workers). |
| `pnpm build` | Compila todos os pacotes e apps para produção. |
| `pnpm test` | Executa a suíte de testes (Vitest) em todo o monorepo. |
| `pnpm lint` | Executa o linter. |

## Tabela de Portas

| Serviço | Porta |
| :--- | :--- |
| **Web App** | 5173 |
| **API GraphQL** | 3002 |
| **Workers Dashboard** | 3003 |
| **PostgreSQL** | 5432 |
| **Redis** | 6379 |

## Variáveis de Ambiente Críticas

- `DATABASE_URL`: String de conexão com o PostgreSQL.
- `REDIS_URL`: String de conexão com o Redis.
- `JWT_SECRET`: Chave secreta para assinatura de tokens.
- `INTERNAL_API_KEY`: Chave para comunicação interna entre Workers e API.
- `DEV_ALLOWED_PHONE`: Número de telefone autorizado a receber mensagens no Sandbox.

## Testes

O projeto utiliza **Vitest**.
- **Unitários**: Localizados junto ao código fonte (`*.test.ts`).
- **Integração**: Localizados em `__tests__` nos respectivos apps.
- **Coverage**:
  ```bash
  pnpm test -- --coverage
  ```

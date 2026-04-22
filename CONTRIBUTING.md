# Contribuição

Guia de contribuição para o **CRMed** — sistema de relacionamento e performance clínica do Hospital São Rafael.

---

## Pré-requisitos

- **Node.js** v24+ (veja `.nvmrc`)
- **pnpm** v10+
- **Docker** e **Docker Compose**
- **Git**

## Setup do Ambiente

```bash
# Clone o repositório
git clone https://github.com/GrupoMoskitto/Challenge-2026.git
cd Challenge-2026

# Configure as variáveis de ambiente
cp .env.example .env

# Instale dependências e inicie tudo
npm install --global pnpm
pnpm install
pnpm infra:dev
```

> [!TIP]
> O comando `pnpm infra:dev` automatiza todo o setup: Docker, banco de dados com seed, Evolution API e todos os apps em paralelo.

---

## Workflow de Contribuição

1. Crie uma branch a partir de `main` seguindo o padrão de nomenclatura
2. Faça suas alterações com commits semânticos
3. Valide com testes e build antes de abrir o PR
4. Abra um Pull Request descrevendo as mudanças

---

## Branches

Padrão: `MOSK-0000/tipo/tarefa-em-ingles`

```
MOSK-0000/feat/add-login-screen
MOSK-0012/fix/dashboard-chart-tooltip
MOSK-0045/refactor/extract-lead-service
MOSK-0078/docs/update-api-reference
```

| Tipo | Uso |
| --- | --- |
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Documentação |
| `test` | Adição ou correção de testes |
| `chore` | Tarefas de manutenção (configs, deps) |
| `ci` | Alterações no CI/CD |

---

## Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/). O formato é:

```
tipo(escopo): descrição curta em inglês
```

**Exemplos:**

```
feat(api): implement RN03 hierarchy constraints
fix(auth): prevent infinite redirect loop
docs: update README with CI/CD section
test(rns): add vitest unit tests
chore(eslint): setup monorepo linting
ci(github): setup CI pipeline
refactor(web): extract dashboard chart component
```

**Escopos comuns:** `api`, `web`, `workers`, `database`, `auth`, `rns`, `eslint`, `github`

---

## Estrutura do Código

| Caminho | Descrição |
| --- | --- |
| `apps/api/` | Backend GraphQL (Apollo Server) |
| `apps/web/` | Dashboard interno (React + Vite) |
| `apps/workers/` | Workers BullMQ (lembretes WhatsApp) |
| `packages/database/` | Prisma ORM — schema, migrations, client |
| `packages/types/` | Tipos TypeScript compartilhados |
| `packages/ui/` | Componentes React reutilizáveis |
| `packages/config/` | ESLint, Prettier, TSConfig |

---

## Nomenclatura

| Contexto | Padrão | Exemplo |
| --- | --- | --- |
| Arquivos/pastas | `kebab-case` | `lead-webhook.ts` |
| Componentes React | `PascalCase` | `LeadCard.tsx` |
| Funções/variáveis | `camelCase` | `checkUniqueness()` |
| Enums Prisma | `UPPER_SNAKE_CASE` | `CALL_CENTER` |
| Variáveis de ambiente | `UPPER_SNAKE_CASE` | `DATABASE_URL` |

---

## Regras de Negócio

> [!CAUTION]
> **Nunca viole estas regras.** Elas são validadas por testes automatizados.

| RN | Regra | O que fazer |
| --- | --- | --- |
| **RN01** | Duplicidade Zero | Use `checkUniqueness()` antes de inserir/atualizar leads/pacientes |
| **RN03** | Hierarquia | Verifique `context.user.role` antes de status críticos (CONVERTED, LOST) |
| **RN05** | Ciclo de Notificações | Não altere a lógica de scheduling dos workers |
| **RN06** | Auditoria | Toda alteração de status deve gerar um `AuditLog` |

---

## Testes

```bash
# Rodar testes da API
pnpm --filter @crmed/api test

# Rodar testes do frontend
pnpm --filter @crmed/web test

# Verificar build TypeScript
pnpm --filter @crmed/web build
```

> [!IMPORTANT]
> Sempre rode os testes antes de abrir um PR. O CI rejeita PRs com testes falhando.

### Ao corrigir bugs

1. Escreva o teste que reproduz o bug **antes** de aplicar a correção
2. Aplique a correção
3. Confirme que o teste passa

---

## Alterações no Schema

Se você modificar `packages/database/prisma/schema.prisma`:

```bash
pnpm --filter @crmed/database db:setup
```

Isso executa `prisma generate` + `prisma migrate dev` + `seed`.

---

## AGENTS.md

O arquivo [`AGENTS.md`](AGENTS.md) na raiz do projeto é a **fonte de verdade para agentes de IA** (GitHub Copilot, Cursor, Gemini CLI, etc.). Ele funciona como um "onboarding automático" — quando um agente lê o arquivo, ele absorve o contexto do projeto, as regras de negócio e os padrões de código sem precisar de instruções manuais.

### O que contém

- **Contexto do projeto** — arquitetura, stack e estrutura do monorepo
- **Regras de negócio críticas** (RN01–RN06) — o que nunca pode ser violado
- **Diretrizes de codificação** — padrões por camada (API, frontend, workers, database)
- **Nomenclatura** — convenções de nomes para arquivos, variáveis e branches
- **Segurança** — práticas obrigatórias (hashing, JWT, sandbox)
- **Scripts úteis** — comandos para rodar, testar e configurar o projeto

### Como usar

Basta ter o arquivo na raiz do repositório. Os agentes de IA compatíveis o detectam automaticamente e aplicam as diretrizes ao gerar ou revisar código. Nenhuma configuração extra é necessária.

### Como contribuir no AGENTS.md

Mantenha o `AGENTS.md` atualizado sempre que houver mudanças relevantes:

| Mudança no projeto | Ação no AGENTS.md |
| --- | --- |
| Nova regra de negócio | Adicionar na tabela de RNs com impacto |
| Novo pacote no monorepo | Atualizar a seção de arquitetura |
| Nova tecnologia na stack | Atualizar a tabela de stack |
| Novo padrão de código | Adicionar nas diretrizes da camada correspondente |
| Novo script de desenvolvimento | Adicionar na seção de uso de ferramentas |

> [!WARNING]
> O `AGENTS.md` é lido por agentes de IA como instrução direta. Informações desatualizadas ou incorretas farão o agente gerar código fora do padrão. Trate-o com o mesmo rigor que o schema Prisma.

---

## Checklist do PR

- [ ] Branch segue o padrão `MOSK-0000/tipo/tarefa`
- [ ] Commits seguem Conventional Commits
- [ ] Testes passando (`pnpm --filter @crmed/api test`)
- [ ] Build sem erros (`pnpm build`)
- [ ] Regras de negócio (RN01–RN06) respeitadas
- [ ] Schema Prisma atualizado com `db:setup` (se alterado)
- [ ] README atualizado (se a mudança afeta setup, scripts ou variáveis)

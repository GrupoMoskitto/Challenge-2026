# AGENTS.md — CRMed

## Persona

You are a **Senior Software Engineer** specialized in full-stack TypeScript applications. Your goal is to accelerate CRMed development while maintaining architectural consistency, respecting critical business rules, and ensuring code quality.

## Project Context

**CRMed** is the clinical relationship and performance system for Hospital São Rafael. Manages the complete patient journey: lead capture, surgery scheduling, WhatsApp contact automation, and post-operative follow-up.

### Architecture

```
apps/api          → GraphQL backend (Apollo Server, Node.js)
apps/web          → Internal dashboard (React 18, Vite, Tailwind CSS)
apps/workers      → BullMQ workers (WhatsApp reminders via Evolution API)
functions/        → AWS Lambdas (PDF, webhooks)
packages/database → Prisma ORM (schema, migrations, shared client)
packages/config   → Shared ESLint, Prettier, TSConfig
packages/types    → Shared TypeScript types
packages/ui       → Reusable React components
infra/            → Docker, Evolution API
```

### Stack

| Layer | Technologies |
| --- | --- |
| Backend | Node.js v24, TypeScript strict, Apollo Server (GraphQL) |
| Frontend | React 18, Vite, Tailwind CSS, Radix UI, shadcn/ui |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Tests | Vitest |

---

## Critical Business Rules

**Never violate these rules. They exist in code and tests.**

| RN | Rule | Impact |
| --- | --- | --- |
| **RN01** | **Zero Duplicates** — Use `checkUniqueness()` from `@crmed/database` | Tests break, data corrupts |
| **RN03** | **Hierarchy** — RECEPTION cannot change status to CONVERTED/LOST | Security violation |
| **RN06** | **Audit** — Every status change creates `AuditLog` | Loss of traceability |

---

## Code Style Guidelines

### General

- **TypeScript strict** — no `any` except justified Prisma casts
- **Pure functions** — no classes
- **Workspace imports** — always use `@crmed/database`, `@crmed/types`
- **Base64 URL-safe IDs** — `Buffer.from(id).toString('base64url')`
- **ISO 8601 dates** — use `date-fns` for manipulation
- **Avoid `any`** — use `Record<string, unknown>` for dynamic objects

### Naming Conventions

| Context | Pattern | Example |
| --- | --- | --- |
| Files/folders | kebab-case | `lead-webhook.ts` |
| React components | PascalCase | `LeadCard.tsx` |
| Functions/variables | camelCase | `checkUniqueness()` |
| Prisma enums | UPPER_SNAKE_CASE | `CALL_CENTER` |
| Branches | `MOSK-0000/type/task` | `MOSK-0012/feat/add-chart` |
| Commits | Semantic Commits | `feat(api): add surgeon filter` |

### Error Handling

- Always use `throw new Error()` — never silent returns
- Prefix semantic errors: `RN01_VIOLATION:`, `RN03_VIOLATION:`
- Authentication errors must be generic: `"Credenciais inválidas"`
- Log errors with structured logger: `logger.error('Context', 'Message', error)`

### Backend Patterns

- Auth check first: `if (!context.user) throw new Error('Usuário não autenticado')`
- Role check: `if (context.user.role !== 'ADMIN') throw new Error('Acesso restrito a administradores')`
- Use cursor-based pagination with `Connection` types (e.g., `UserConnection`, `LeadConnection`)
- Always create `AuditLog` on status changes (RN06)

### GraphQL Pagination

When adding new queries that return lists, always use Connection pattern:
```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
type UserEdge {
  node: User!
  cursor: String!
}
```

Frontend must map: `data?.users?.edges?.map((e) => e.node)`

---

## Frontend Patterns

### Tab Navigation
- Use `useSearchParams` for tab state: `searchParams.get("tab")`
- Preserve tab state in URL for deep linking (e.g., `?tab=contacts`)
- **Prefer Radix UI TabsContent** over AnimatePresence for tabs to avoid flicker/unmount issues:
  ```tsx
  <Tabs value={activeTab} onValueChange={handleTabChange}>
    <TabsList>...</TabsList>
    <TabsContent value="details">...</TabsContent>
    <TabsContent value="other">...</TabsContent>
  </Tabs>
  ```
- Add CSS transitions to `TabsContent` component for smooth animations (already in `@/components/ui/tabs.tsx`)
- TabsContent includes `transition-all duration-200 ease-in-out` for smooth tab switching
- Always import TabsContent: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`
- Use skeleton patterns from `@/components/ui/skeleton`: `CardSkeleton`, `ListSkeleton`, `CardListSkeleton`, `FormSkeleton`
- Use `cache-first` fetchPolicy for instant data display without loading screens

---

## Commands

```bash
# Development
pnpm dev                              # All apps (ports: 3000 web, 3001 API, 3002 workers)
pnpm --filter @crmed/api dev          # API only
pnpm --filter @crmed/web dev          # Web only

# Build & Lint
pnpm build                            # Build all
pnpm lint                             # Lint all

# Testing (requires JWT_SECRET and REFRESH_SECRET env vars)
pnpm test                             # Run all tests
JWT_SECRET=test-secret REFRESH_SECRET=test-refresh pnpm --filter @crmed/api test  # API tests

# Single test
pnpm --filter @crmed/api test -- <test-file>
pnpm --filter @crmed/api test -- --grep="test name"

# Database
pnpm --filter @crmed/database db:setup   # generate + migrate + seed
pnpm --filter @crmed/database db:generate
```

---

## Common Issues

### Rate Limiting
- Login: 5 attempts per 15 min per IP
- GraphQL API: 200 requests per 15 min per IP (`express-rate-limit` in apps/api/src/index.ts)
- If you get 429 errors, restart the API to clear limits: `fuser -k 3001/tcp && pnpm --filter @crmed/api dev &`
- Rate limits are in-memory only — server restart clears them

### Dashboard Loops
- Always use `useMemo` for `new Date()` to prevent infinite re-renders:
  ```typescript
  const today = useMemo(() => new Date(), []);
  ```
- Use `cache-first` fetchPolicy for stable queries like `performanceMetrics`

### Dialog/Modal Patterns
- Always add className to DialogContent: `className="sm:max-w-lg"`
- Missing className causes modal to open invisible/gray

### Undo/Feedback Patterns
- Use `showUndoableToast` from `@/hooks/useUndoableToast` for actionable feedback:
  ```typescript
  // Save previous state before mutation
  const previousState = { ...patient };
  
  // On undo, revert to previous state via mutation
  showUndoableToast(
    "Dados atualizados!",
    async () => {
      await updatePatient({
        variables: { input: { id: patient.id, ...previousState } }
      });
    },
    "Desfazer"
  );
  ```

### CSV Export
- Backend returns base64-encoded data URL: `data:text/csv;base64,...`
- Frontend must decode: 
  ```typescript
  const base64Data = csvContent.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const csvText = new TextDecoder('utf-8').decode(bytes);
  ```

### UI Component Imports
- Always import all needed components from Radix/shadcn:
  ```typescript
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  ```
- Missing imports cause `ReferenceError` at runtime

---

## Security

- **Never** expose `password` in GraphQL resolvers
- **Never** log tokens, passwords, or API keys
- Validate inputs before passing to Prisma
- Use `hashPassword()` from `src/auth.ts` for passwords
- `DEV_ALLOWED_PHONE` must be respected in message sending

---

## Before Modifying Code

1. Read Prisma schema in `packages/database/prisma/schema.prisma`
2. Read resolvers in `apps/api/src/graphql/resolvers/index.ts`
3. Check existing tests in `apps/api/src/__tests__/`

## After Modifying Code

1. Run `JWT_SECRET=test-secret REFRESH_SECRET=test-refresh pnpm --filter @crmed/api test`
2. Run `pnpm --filter @crmed/web build` to validate TypeScript
3. If schema changed: `pnpm --filter @crmed/database db:setup`
4. Run `pnpm lint`

---

## Behavior

- **Direct and technical** — no fluff
- **Always justify** RN impact
- **Fail early** — throw errors with clear messages
- **Don't assume** — ask if ambiguous
- **Tests first** — write failing test before fix
- **Backward-compatible** — GraphQL changes must not break existing queries
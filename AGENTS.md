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
- **Strict Enum Validation**: Use `validateEnum` from `config/rbac` for all GraphQL input strings that map to Prisma enums.

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
  // use only debouncedSearch in useQuery variables
  ```
- **URL & State Synchronization** — To prevent infinite loops, follow the **One-Way Sync with Manual Triggers** pattern:
  - **URL to State:** Use a single `useEffect` to sync URL params into local state.
  - **State to URL:** NEVER use a reactive `useEffect` to sync state back to the URL. Instead, update the URL manually in event handlers (e.g., `handleTabChange`, `onSearchChange`) using a centralized `updateUrl` helper.
  - **Equality Check:** Always compare the current `searchParams.toString()` with the new one before calling `setSearchParams` to avoid redundant re-renders.
- **Skeleton Anti-CLS** — Skeletons must mirror the real layout exactly (same column count, card heights, header structure). Generic `<Skeleton className="h-20 w-full" />` causes layout shift and is not acceptable.
- **Optimistic UI** — Use Apollo `optimisticResponse` for mutations that change visible state (drag-and-drop, status changes). Always provide a `cache.modify` `update` function as well:
  ```tsx
  await mutation({
    variables: { ... },
    optimisticResponse: { __typename: "Lead", id, status: newStatus },
  });
  ```
- **Empty States** — Never leave columns or list sections empty/blank. Use a dashed-border box with a muted icon and descriptive text:
  ```tsx
  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-60 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-muted/20">
    <SomeIcon className="h-10 w-10 mb-2 opacity-50" />
    <p className="text-sm font-medium">Nenhum registro</p>
  </div>
  ```
- **Apollo Cache Updates** — Prefer `cache.modify` over `cache.writeQuery` for partial updates. For list mutations (create/delete), always update the cache immediately:
  ```tsx
  const [deleteItem] = useMutation(DELETE_ITEM, {
    onCompleted: () => setTimeout(() => refetch(), 1000), // sync after 1s
    update(cache, { data }, { variables }) {
      cache.modify({
        fields: {
          items(existing = []) {
            return existing.filter((i: any) => i.instanceName !== variables?.name);
          }
        }
      });
    }
  });
  ```

---

## Evolution API Integration

The Evolution API integration lives entirely in `apps/api/src/graphql/resolvers/index.ts`. Key patterns:

- **Always type JSON responses** — never use `await response.json()` bare. Cast to a specific interface:
  ```typescript
  const data = (await response.json()) as { instance?: { state?: string; instanceName?: string } };
  ```
- **Always include `integration: "WHATSAPP-BAILEYS"`** in the create instance request body.
- **Error extraction** — Evolution API nests errors in `response.message`. Use:
  ```typescript
  const nested = errorBody.response as Record<string, unknown> | undefined;
  const msg = (nested?.message as string) || (errorBody.message as string) || JSON.stringify(errorBody);
  ```
- **Never use `confirm()`** for destructive actions — always use a `<Dialog>` with a descriptive warning.
- **State variables for dialogs**:
  ```tsx
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  ```

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
- GraphQL API: 200 requests per 15 min per IP
- Rate limiting is distributed via **Redis** (`rate-limit-redis` in `apps/api/src/index.ts`). Limits persist across API restarts.
- If you get 429 errors in dev, you must flush the Redis instance: `redis-cli flushall`

### TypeScript Strict Mode (no `any`)
- All `response.json()` calls **must** be explicitly typed: `as Record<string, unknown>` or a specific interface
- Catch variables are `unknown` in strict mode — always cast: `const err = (await res.json().catch(() => ({}))) as Record<string, unknown>`
- Empty objects for fallback: `let body: Record<string, unknown> = {}` — never just `{}`
- Unused catch variables: use `_e` instead of `e` to avoid lint warnings

- Use `cache-first` fetchPolicy for stable queries like `performanceMetrics`

### Infinite Navigation Loops
- Occur when a reactive `useEffect` tries to sync state back to the URL while another effect is syncing the URL back to state.
- **Fix:** Remove the state-to-url effect and use explicit `updateUrl` calls in user interaction handlers.
- **Guard:** Always use `if (newParams.toString() !== searchParams.toString())` before calling `setSearchParams`.

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
- **Authentication**: Tokens are stored strictly in `HttpOnly` cookies. Never write access tokens to `localStorage` or JavaScript variables.
- **Apollo Client**: Always use `credentials: 'include'` when calling the API to send the secure cookies.
- **RBAC**: Always use centralized helpers (`assertAuthenticated`, `assertRole`, `enforceStatusChange`) from `apps/api/src/config/rbac.ts` at the beginning of sensitive resolvers.
- **Enum Validation**: Do not trust client inputs for enums. Always validate on the server using `validateEnum()`.
- **Webhooks**: External endpoints (like Evolution API callbacks) must use `webhookSecurityMiddleware` for HMAC-SHA256 signature validation and IP allowlists.
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
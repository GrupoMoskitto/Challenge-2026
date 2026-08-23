---
description: Rules for Prisma integrated creation, Audit Logs, and RN06/RN03 enforcement.
trigger: model_decision
---

# Prisma Integrated Creation & Audit (RN03/RN06)

**Core Directive:** 
When creating inter-dependent entities (e.g., a `User` linked to a `Surgeon`), execute all operations within a single Prisma `$transaction`. To satisfy **RN06**, you MUST append an `AuditLog` creation within the exact same transaction whenever an entity is created or a status changes. To satisfy **RN03**, enforce Role-Based Access Control before opening the transaction.

**Explicit Anti-Patterns:**
- **NEVER** execute independent `prisma.user.create` and `prisma.surgeon.create` outside of a transaction context.
- **NEVER** modify a patient's or lead's status without creating an associated `AuditLog`.
- **NEVER** assume the frontend validated user roles; always run `assertRole` server-side.

**TypeScript Template:**
```typescript
import { PrismaClient } from '@prisma/client';
import { assertAuthenticated, assertRole } from '@/config/rbac';
import { GraphQLError } from 'graphql';

const prisma = new PrismaClient();

export const createSurgeon = async (
  _parent: unknown,
  args: { input: Record<string, unknown> },
  context: GraphQLContext
) => {
  // RN03: Hierarchy and Security check
  assertAuthenticated(context);
  assertRole(context, 'ADMIN');

  // Note: Strict TS requires typing input rather than casting in production
  const { name, email, passwordHash, specialty, crm } = args.input as any;

  return prisma.$transaction(async (tx) => {
    // 1. Create Base User
    const user = await tx.user.create({
      data: { name, email, password: passwordHash, role: 'SURGEON' },
    });

    // 2. Create Surgeon Profile
    const surgeon = await tx.surgeon.create({
      data: { userId: user.id, specialty, crm },
    });

    // 3. RN06: Mandatory Audit Trail inside the transaction
    await tx.auditLog.create({
      data: {
        userId: context.user.id,
        action: 'CREATE',
        entity: 'SURGEON',
        entityId: surgeon.id,
        details: { specialty, crm },
      },
    });

    return surgeon;
  });
};
```

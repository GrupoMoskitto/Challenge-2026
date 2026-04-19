/**
 * RBAC — Role-Based Access Control wrappers for GraphQL resolvers
 * 
 * Centralizes authentication, role verification, and business rule enforcement
 * for RN03 (Hierarchy) and RN06 (Audit).
 */

import { prisma } from '@crmed/database';
import { UserRole } from '@prisma/client';
import type { Context } from '../graphql/resolvers';
import { logger } from './logger';

// Valid UserRole values from Prisma enum for server-side validation
const VALID_ROLES: ReadonlySet<string> = new Set<string>(Object.values(UserRole));

/**
 * Validates that a given status string belongs to a Prisma enum.
 * Prevents clients from sending arbitrary status values.
 */
export function validateEnum<T extends Record<string, string>>(
  value: string,
  enumObj: T,
  fieldName: string
): T[keyof T] {
  const validValues = Object.values(enumObj) as string[];
  if (!validValues.includes(value)) {
    throw new Error(
      `Valor inválido para ${fieldName}: "${value}". Valores aceitos: ${validValues.join(', ')}`
    );
  }
  return value as T[keyof T];
}

/**
 * Asserts that the context has an authenticated user.
 * Throws a semantic error if not.
 */
export function assertAuthenticated(context: Context): asserts context is Context & {
  user: { userId: string; email: string; role: string };
} {
  if (!context.user) {
    throw new Error('Usuário não autenticado');
  }
}

/**
 * Asserts that the authenticated user has one of the specified roles.
 * Must be called after assertAuthenticated.
 */
export function assertRole(
  context: Context & { user: { userId: string; email: string; role: string } },
  allowedRoles: readonly string[],
  action?: string
): void {
  if (!allowedRoles.includes(context.user.role)) {
    const actionDesc = action ? ` para ${action}` : '';
    logger.warn('RBAC', `Acesso negado${actionDesc}`, {
      userId: context.user.userId,
      role: context.user.role,
      requiredRoles: allowedRoles,
    });
    throw new Error(`Acesso restrito${actionDesc}. Roles permitidos: ${allowedRoles.join(', ')}`);
  }
}

/**
 * Enforces RN03 (Hierarchy) — Blocks specified roles from setting critical statuses.
 * Also enforces RN06 (Audit) — Creates an AuditLog entry for every status change.
 */
export async function enforceStatusChange(options: {
  context: Context & { user: { userId: string; email: string; role: string } };
  entityType: string;
  entityId: string;
  oldStatus: string;
  newStatus: string;
  blockedRoles: readonly string[];
  criticalStatuses: readonly string[];
  reason?: string;
}): Promise<void> {
  const { context, entityType, entityId, oldStatus, newStatus, blockedRoles, criticalStatuses, reason } = options;

  // RN03: Check hierarchy — blocked roles cannot set critical statuses
  if (
    criticalStatuses.includes(newStatus) &&
    blockedRoles.includes(context.user.role)
  ) {
    logger.warn('RBAC:RN03', `RN03_VIOLATION: ${context.user.role} tentou setar ${entityType} para ${newStatus}`, {
      userId: context.user.userId,
      entityId,
      oldStatus,
      newStatus,
    });
    throw new Error(
      `RN03_VIOLATION: Usuários do tipo ${context.user.role} não podem alterar status para ${newStatus}.`
    );
  }

  // RN06: Create audit log for the status change
  if (oldStatus !== newStatus) {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action: 'STATUS_CHANGE',
        oldValue: oldStatus,
        newValue: newStatus,
        reason: reason || 'Alteração de status',
        userId: context.user.userId,
      },
    });
  }
}

/**
 * Checks if a given role string is a valid UserRole.
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.has(role);
}

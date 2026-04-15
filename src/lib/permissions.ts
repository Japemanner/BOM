// src/lib/permissions.ts
import { db } from '@/db'
import { tenantMembers } from '@/db/schema/iam'
import { rolePermissions, permissions } from '@/db/schema/rbac'
import { eq, and } from 'drizzle-orm'

/**
 * Controleert of een gebruiker een specifieke actie mag uitvoeren binnen een tenant.
 *
 * Werkt via drie joins:
 *   iam.tenant_members → rbac.role_permissions → rbac.permissions
 *
 * @returns true als de gebruiker de permissie heeft, anders false.
 */
export async function canDo(
  userId: string,
  tenantId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const result = await db
    .select({ id: permissions.id })
    .from(tenantMembers)
    .innerJoin(rolePermissions, eq(tenantMembers.role, rolePermissions.roleId))
    .innerJoin(
      permissions,
      and(
        eq(rolePermissions.permissionId, permissions.id),
        eq(permissions.resource, resource),
        eq(permissions.action, action)
      )
    )
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.tenantId, tenantId)
      )
    )
    .limit(1)

  return result.length > 0
}

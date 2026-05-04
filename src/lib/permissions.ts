// src/lib/permissions.ts
import { db } from '@/db'
import { tenantMembers } from '@/db/schema/iam'
import { rolePermissions, permissions } from '@/db/schema/rbac'
import { eq, and } from 'drizzle-orm'
import { UserRole } from '@/types'

/**
 * Controleert of een gebruiker een specifieke actie mag uitvoeren binnen een tenant.
 *
 * Werkt via drie joins:
 *   iam.tenant_members → rbac.role_permissions → rbac.permissions
 *
 * Super admins krijgen automatisch alle permissies op alle tenants, ongeacht
 * of ze lid zijn van de opgevraagde tenant.
 *
 * @returns true als de gebruiker de permissie heeft, anders false.
 */
export async function canDo(
  userId: string,
  tenantId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const isSuperAdmin = await isUserSuperAdmin(userId)
  if (isSuperAdmin) return true

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

/**
 * Checkt of een gebruiker een super_admin rol heeft in een willekeurige tenant.
 */
export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.role, UserRole.SUPER_ADMIN)
      )
    )
    .limit(1)

  return result.length > 0
}

/**
 * Haalt de rol van een gebruiker op binnen een specifieke tenant.
 * Retourneert null als de gebruiker geen lid is van de tenant.
 */
export async function getUserRole(userId: string, tenantId: string): Promise<string | null> {
  const [membership] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.tenantId, tenantId)
      )
    )
    .limit(1)

  return membership?.role ?? null
}

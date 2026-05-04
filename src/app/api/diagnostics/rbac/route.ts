import { NextResponse } from 'next/server'
import { db } from '@/db'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { tenantMembers } from '@/db/schema/iam'
import { roles, rolePermissions } from '@/db/schema/rbac'
import { eq, and, sql } from 'drizzle-orm'

/**
 * GET /api/diagnostics/rbac
 * Retourneert de effectieve permissies, seed-status en rol van de ingelogde gebruiker.
 * Alleen voor debugging — geen RBAC-check op deze route zelf.
 */
export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  try {
    const [membership] = await db
      .select({ role: tenantMembers.role, userId: tenantMembers.userId, tenantId: tenantMembers.tenantId })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
      .limit(1)

    const seedStatusRows = await db
      .select({
        totalRoles: sql<number>`(SELECT count(*)::int FROM rbac.roles)`,
        totalPermissions: sql<number>`(SELECT count(*)::int FROM rbac.permissions)`,
        totalRolePermissions: sql<number>`(SELECT count(*)::int FROM rbac.role_permissions)`,
      })
      .from(roles)
      .limit(1)
    const seedStatus = seedStatusRows[0]

    let rolePermissionDetail: { roleId: string; permissionId: string; hasEntry: boolean }[] = []
    if (membership) {
      rolePermissionDetail = await db
        .select({
          roleId: rolePermissions.roleId,
          permissionId: rolePermissions.permissionId,
          hasEntry: sql<boolean>`true`,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, membership.role))
    }

    const checks: { resource: string; action: string; name: string }[] = [
      { resource: 'assistants', action: 'read', name: 'assistants.read' },
      { resource: 'assistants', action: 'create', name: 'assistants.create' },
      { resource: 'assistants', action: 'update', name: 'assistants.update' },
      { resource: 'assistants', action: 'delete', name: 'assistants.delete' },
      { resource: 'assistants', action: 'toggle_status', name: 'assistants.toggle_status' },
      { resource: 'knowledge_sources', action: 'read', name: 'knowledge_sources.read' },
      { resource: 'knowledge_sources', action: 'create', name: 'knowledge_sources.create' },
      { resource: 'knowledge_sources', action: 'update', name: 'knowledge_sources.update' },
      { resource: 'knowledge_sources', action: 'delete', name: 'knowledge_sources.delete' },
      { resource: 'integrations', action: 'read', name: 'integrations.read' },
      { resource: 'webhooks', action: 'manage', name: 'webhooks.manage' },
    ]

    const results = await Promise.all(
      checks.map(async ({ resource, action, name }) => ({
        name,
        hasAccess: await canDo(userId, tenantId, resource, action),
      }))
    )

    const hasKsCreate = results.find(r => r.name === 'knowledge_sources.create')?.hasAccess ?? false

    return NextResponse.json({
      userId,
      tenantId,
      userRole: membership?.role ?? null,
      seedStatus: {
        totalRoles: seedStatus?.totalRoles ?? 0,
        totalPermissions: seedStatus?.totalPermissions ?? 0,
        totalRolePermissions: seedStatus?.totalRolePermissions ?? 0,
        isSeeded: (seedStatus?.totalRoles ?? 0) >= 2 && (seedStatus?.totalPermissions ?? 0) >= 20,
      },
      rolePermissionsForUserRole: rolePermissionDetail.length > 0
        ? rolePermissionDetail.map(rp => rp.permissionId)
        : null,
      knowledgeSourcesCreate: {
        hasAccess: hasKsCreate,
        diagnosis: hasKsCreate
          ? null
          : membership
            ? `Rol '${membership.role}' heeft deze permissie NIET in rbac.role_permissions. Seed uitgevoerd? ${(seedStatus?.totalRolePermissions ?? 0) >= 40 ? 'Ja' : 'Nee'}`
            : 'Geen lidmaatschap gevonden in iam.tenant_members',
      },
      permissions: results.reduce<Record<string, boolean>>((acc, r) => {
        acc[r.name] = r.hasAccess
        return acc
      }, {}),
    })
  } catch (error) {
    console.error('[diagnostics/rbac]', error)
    return NextResponse.json({ error: 'Diagnostics mislukt' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { tenantMembers } from '@/db/schema/iam'
import { roles, rolePermissions, permissions as permissionsTable } from '@/db/schema/rbac'
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

const ROLES = [
  { id: 'super_admin', description: 'Platform-beheerder: volledige toegang tot alle tenants en functies' },
  { id: 'admin',  description: 'Volledige toegang tot alle functies binnen eigen organisatie' },
  { id: 'member', description: 'Lees- en schrijftoegang tot assistenten, integraties, kennisbronnen en tenant-info' },
]

const PERMISSIONS = [
  { id: 'assistants.create',         resource: 'assistants',   action: 'create',             description: 'Assistent aanmaken' },
  { id: 'assistants.read',           resource: 'assistants',   action: 'read',               description: 'Assistenten bekijken' },
  { id: 'assistants.update',         resource: 'assistants',   action: 'update',             description: 'Assistent bewerken' },
  { id: 'assistants.delete',         resource: 'assistants',   action: 'delete',             description: 'Assistent verwijderen' },
  { id: 'assistants.toggle_status',  resource: 'assistants',   action: 'toggle_status',      description: 'Assistent activeren of pauzeren' },
  { id: 'integrations.read',         resource: 'integrations', action: 'read',               description: 'Integraties bekijken' },
  { id: 'integrations.create',       resource: 'integrations', action: 'create',             description: 'Integratie aanmaken' },
  { id: 'integrations.update',       resource: 'integrations', action: 'update',             description: 'Integratie bewerken' },
  { id: 'integrations.delete',       resource: 'integrations', action: 'delete',             description: 'Integratie verwijderen' },
  { id: 'tenant.read',               resource: 'tenant',       action: 'read',               description: 'Tenant-info bekijken' },
  { id: 'tenant.update_plan',        resource: 'tenant',       action: 'update_plan',        description: 'Abonnement wijzigen' },
  { id: 'tenant.delete',             resource: 'tenant',       action: 'delete',             description: 'Tenant verwijderen' },
  { id: 'tenant.invite_user',        resource: 'tenant',       action: 'invite_user',        description: 'Gebruiker uitnodigen' },
  { id: 'tenant.remove_user',        resource: 'tenant',       action: 'remove_user',        description: 'Gebruiker verwijderen' },
  { id: 'tenant.update_member_role', resource: 'tenant',       action: 'update_member_role', description: 'Rol van lid wijzigen' },
  { id: 'webhooks.manage',           resource: 'webhooks',     action: 'manage',             description: 'Webhook tokens beheren' },
  { id: 'knowledge_sources.read',    resource: 'knowledge_sources', action: 'read',          description: 'Kennisbronnen bekijken' },
  { id: 'knowledge_sources.create',  resource: 'knowledge_sources', action: 'create',        description: 'Kennisbron aanmaken' },
  { id: 'knowledge_sources.update',  resource: 'knowledge_sources', action: 'update',        description: 'Kennisbron bewerken' },
  { id: 'knowledge_sources.delete',  resource: 'knowledge_sources', action: 'delete',        description: 'Kennisbron verwijderen' },
]

export async function POST() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx

  try {
    const rolePermissionRows: { roleId: string; permissionId: string }[] = [
      ...PERMISSIONS.map((p) => ({ roleId: 'super_admin', permissionId: p.id })),
      ...PERMISSIONS.map((p) => ({ roleId: 'admin', permissionId: p.id })),
      { roleId: 'member', permissionId: 'assistants.read' },
      { roleId: 'member', permissionId: 'integrations.read' },
      { roleId: 'member', permissionId: 'tenant.read' },
      { roleId: 'member', permissionId: 'knowledge_sources.read' },
      { roleId: 'member', permissionId: 'knowledge_sources.create' },
      { roleId: 'member', permissionId: 'knowledge_sources.update' },
      { roleId: 'member', permissionId: 'knowledge_sources.delete' },
    ]

    await db.insert(roles).values(ROLES).onConflictDoNothing()
    await db.insert(permissionsTable).values(PERMISSIONS).onConflictDoNothing()
    await db.insert(rolePermissions).values(rolePermissionRows).onConflictDoNothing()

    return NextResponse.json({
      ok: true,
      roles: ROLES.length,
      permissions: PERMISSIONS.length,
      rolePermissions: rolePermissionRows.length,
    })
  } catch (error) {
    console.error('[diagnostics/rbac POST]', error)
    return NextResponse.json({ error: 'Seed mislukt' }, { status: 500 })
  }
}

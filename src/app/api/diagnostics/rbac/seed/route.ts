import { NextResponse } from 'next/server'
import { db } from '@/db'
import { roles, permissions, rolePermissions } from '@/db/schema/rbac'

const ROLES = [
  { id: 'admin',  description: 'Volledige toegang tot alle functies' },
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
  { id: 'knowledge_sources.read',    resource: 'knowledge_sources', action: 'read',              description: 'Kennisbronnen bekijken' },
  { id: 'knowledge_sources.create',  resource: 'knowledge_sources', action: 'create',            description: 'Kennisbron aanmaken' },
  { id: 'knowledge_sources.update',  resource: 'knowledge_sources', action: 'update',            description: 'Kennisbron bewerken' },
  { id: 'knowledge_sources.delete',  resource: 'knowledge_sources', action: 'delete',            description: 'Kennisbron verwijderen' },
]

const ROLE_PERMISSIONS: { roleId: string; permissionId: string }[] = [
  ...PERMISSIONS.map((p) => ({ roleId: 'admin', permissionId: p.id })),
  { roleId: 'member', permissionId: 'assistants.read' },
  { roleId: 'member', permissionId: 'integrations.read' },
  { roleId: 'member', permissionId: 'tenant.read' },
  { roleId: 'member', permissionId: 'knowledge_sources.read' },
  { roleId: 'member', permissionId: 'knowledge_sources.create' },
  { roleId: 'member', permissionId: 'knowledge_sources.update' },
  { roleId: 'member', permissionId: 'knowledge_sources.delete' },
]

async function runSeed() {
  await db.insert(roles).values(ROLES).onConflictDoNothing()
  await db.insert(permissions).values(PERMISSIONS).onConflictDoNothing()
  await db.insert(rolePermissions).values(ROLE_PERMISSIONS).onConflictDoNothing()
}

export async function GET() {
  try {
    await runSeed()
    return NextResponse.json({
      success: true,
      message: 'RBAC seed uitgevoerd',
      counts: { roles: ROLES.length, permissions: PERMISSIONS.length, rolePermissions: ROLE_PERMISSIONS.length },
    })
  } catch (error) {
    console.error('[seed/rbac]', error)
    return NextResponse.json({ error: 'Seed mislukt' }, { status: 500 })
  }
}

export async function POST() {
  try {
    await runSeed()
    return NextResponse.json({
      success: true,
      message: 'RBAC seed uitgevoerd',
      counts: { roles: ROLES.length, permissions: PERMISSIONS.length, rolePermissions: ROLE_PERMISSIONS.length },
    })
  } catch (error) {
    console.error('[seed/rbac]', error)
    return NextResponse.json({ error: 'Seed mislukt' }, { status: 500 })
  }
}

// src/db/seed-rbac.ts
// Gebruik: npx tsx src/db/seed-rbac.ts
import { db } from '@/db'
import { roles, permissions, rolePermissions } from '@/db/schema/rbac'

const ROLES = [
  { id: 'admin',  description: 'Volledige toegang tot alle functies' },
  { id: 'member', description: 'Alleen-lezen toegang tot assistenten, integraties en tenant-info' },
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
]

const ROLE_PERMISSIONS: { roleId: string; permissionId: string }[] = [
  // Admin: alle 15 permissies
  ...PERMISSIONS.map((p) => ({ roleId: 'admin', permissionId: p.id })),
  // Member: 3 permissies
  { roleId: 'member', permissionId: 'assistants.read' },
  { roleId: 'member', permissionId: 'integrations.read' },
  { roleId: 'member', permissionId: 'tenant.read' },
]

async function seed() {
  console.log('Seeding RBAC data...')

  await db.insert(roles).values(ROLES).onConflictDoNothing()
  console.log(`✓ ${ROLES.length} roles`)

  await db.insert(permissions).values(PERMISSIONS).onConflictDoNothing()
  console.log(`✓ ${PERMISSIONS.length} permissions`)

  await db.insert(rolePermissions).values(ROLE_PERMISSIONS).onConflictDoNothing()
  console.log(`✓ ${ROLE_PERMISSIONS.length} role_permissions`)

  console.log('Klaar.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})

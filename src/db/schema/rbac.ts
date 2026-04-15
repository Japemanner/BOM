// src/db/schema/rbac.ts
import { pgSchema, text, primaryKey } from 'drizzle-orm/pg-core'

export const rbacSchema = pgSchema('rbac')

export const roles = rbacSchema.table('roles', {
  id: text('id').primaryKey(),         // 'admin' | 'member'
  description: text('description').notNull(),
})

export const permissions = rbacSchema.table('permissions', {
  id: text('id').primaryKey(),         // '<resource>.<action>'
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description').notNull(),
})

export const rolePermissions = rbacSchema.table(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
)

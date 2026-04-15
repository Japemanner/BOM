// src/db/schema/iam.ts
import { pgSchema, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { roles } from './rbac'

export const iamSchema = pgSchema('iam')

export const tenants = iamSchema.table('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),  // 'free' | 'pro' | 'enterprise'
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tenantMembers = iamSchema.table(
  'tenant_members',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role')
      .notNull()
      .default('member')
      .references(() => roles.id),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.userId] })]
)

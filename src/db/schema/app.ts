// src/db/schema/app.ts
import { pgSchema, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { tenants } from './iam'
import { users } from './auth'

export const appSchema = pgSchema('app')

export const assistants = appSchema.table('assistants', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull(),
  status: text('status').notNull().default('paused'),  // 'active' | 'paused' | 'error'
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  webhookUrl: text('webhook_url'),
  webhookTokenEncrypted: text('webhook_token_encrypted'),
})

export const assistantRuns = appSchema.table('assistant_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),  // 'pending' | 'running' | 'success' | 'failed'
  input: jsonb('input').notNull().default({}),
  output: jsonb('output').notNull().default({}),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Geen FK op assistant_id: events blijven bewaard na verwijdering assistent
export const assistantEvents = appSchema.table('assistant_events', {
  id: text('id').primaryKey(),
  assistantId: text('assistant_id').notNull(),
  assistantName: text('assistant_name').notNull(),
  eventType: text('event_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const reviewItems = appSchema.table('review_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default('medium'),  // 'low' | 'medium' | 'high' | 'critical'
  status: text('status').notNull().default('open'),        // 'open' | 'approved' | 'rejected' | 'ignored'
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
})

export const integrations = appSchema.table('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),    // 'exact' | 'ms365' | 'slack' | 'ubl' | 'custom'
  status: text('status').notNull().default('setup'),  // 'active' | 'error' | 'setup'
  config: jsonb('config').notNull().default({}),
  lastCheckedAt: timestamp('last_checked_at'),
})

export const webhookTokens = appSchema.table('webhook_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id')
    .references(() => assistants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})

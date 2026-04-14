// src/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
} from 'drizzle-orm/pg-core'
import {
  UserRole,
  TenantPlan,
  AssistantStatus,
  ReviewPriority,
  ReviewStatus,
  IntegrationType,
  IntegrationStatus,
  RunStatus,
} from '@/types'

// pgvector extensie voor toekomstige RAG:
// CREATE EXTENSION IF NOT EXISTS vector;

// Better Auth genereert eigen text IDs — geen uuid() hier
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').$type<UserRole>().notNull().default(UserRole.MEMBER),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').$type<TenantPlan>().notNull().default(TenantPlan.FREE),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tenantUsers = pgTable('tenant_users', {
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<UserRole>().notNull().default(UserRole.MEMBER),
})

export const assistants = pgTable('assistants', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull(),
  status: text('status')
    .$type<AssistantStatus>()
    .notNull()
    .default(AssistantStatus.PAUSED),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const assistantRuns = pgTable('assistant_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  status: text('status').$type<RunStatus>().notNull(),
  input: jsonb('input').notNull().default({}),
  output: jsonb('output').notNull().default({}),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const reviewItems = pgTable('review_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority')
    .$type<ReviewPriority>()
    .notNull()
    .default(ReviewPriority.MEDIUM),
  status: text('status')
    .$type<ReviewStatus>()
    .notNull()
    .default(ReviewStatus.OPEN),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
})

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').$type<IntegrationType>().notNull(),
  status: text('status')
    .$type<IntegrationStatus>()
    .notNull()
    .default(IntegrationStatus.SETUP),
  config: jsonb('config').notNull().default({}),
  lastCheckedAt: timestamp('last_checked_at'),
})

export const assistantEvents = pgTable('assistant_events', {
  id: text('id').primaryKey(),
  assistantId: text('assistant_id').notNull(),
  assistantName: text('assistant_name').notNull(),
  eventType: text('event_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Better Auth vereiste tabellen
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

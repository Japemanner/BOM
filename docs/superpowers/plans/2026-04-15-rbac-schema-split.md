# RBAC & Auth Schema Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split de bestaande flat `public` PostgreSQL schema op in vier logisch gescheiden schemas (`auth`, `iam`, `rbac`, `app`) en voeg een expliciete RBAC-laag toe met rollen, permissies en een `canDo()` helper.

**Architecture:** Drizzle ORM `pgSchema()` per domein; Better Auth krijgt directe tabelreferenties via `drizzleAdapter`; de migratie verplaatst bestaande tabellen via `ALTER TABLE … SET SCHEMA` zonder dataverlies; alle consumerende bestanden worden bijgewerkt naar de nieuwe subschema-paden.

**Tech Stack:** Drizzle ORM 0.45.2, drizzle-kit, PostgreSQL, Next.js 15 App Router, TypeScript, Better Auth

---

## Bestandsstructuur na implementatie

| Status   | Bestand                              | Verantwoordelijkheid                                      |
|----------|--------------------------------------|-----------------------------------------------------------|
| Nieuw    | `src/db/schema/auth.ts`              | `auth.*` tabellen voor Better Auth                        |
| Nieuw    | `src/db/schema/rbac.ts`              | `rbac.*` rollen + permissies                              |
| Nieuw    | `src/db/schema/iam.ts`               | `iam.*` tenants + tenant_members                          |
| Nieuw    | `src/db/schema/app.ts`               | `app.*` domein-tabellen                                   |
| Nieuw    | `src/db/schema/index.ts`             | Barrel: re-exporteert alles voor backwards compat         |
| Wijzigen | `drizzle.config.ts`                  | schema-pad updaten naar `src/db/schema/index.ts`          |
| Wijzigen | `src/db/index.ts`                    | import bijwerken naar nieuw barrel                        |
| Wijzigen | `src/lib/auth.ts`                    | import van auth-tabellen bijwerken                        |
| Wijzigen | `src/types/index.ts`                 | `Permission` type toevoegen                               |
| Wijzigen | 8 consumerende bestanden             | imports van `@/db/schema` → subschema-paden               |
| Verwijderen | `src/db/schema.ts`               | Vervangt door schema/-map                                 |
| Nieuw    | `src/db/migrations/0004_schema_split_rbac.sql` | Atomische SQL-migratie                        |
| Nieuw    | `src/db/migrations/meta/_journal.json` | Journal-entry voor migratie 0004 (update)             |
| Nieuw    | `src/db/seed-rbac.ts`                | Seed: rollen, permissies, role_permissions                |
| Nieuw    | `src/lib/permissions.ts`             | `canDo()` helper                                          |

---

### Task 1: src/db/schema/auth.ts — Better Auth tabellen in `auth` schema

**Files:**
- Create: `src/db/schema/auth.ts`

- [ ] **Stap 1: Schrijf het nieuwe bestand**

```typescript
// src/db/schema/auth.ts
import { pgSchema, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const authSchema = pgSchema('auth')

export const users = authSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = authSchema.table('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = authSchema.table('accounts', {
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verifications = authSchema.table('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Stap 2: Verifieer TypeScript-compilatie van dit bestand**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Verwacht: geen fouten voor dit nieuwe bestand (bestaande fouten rond `@/db/schema` imports in andere bestanden zijn nu normaal).

- [ ] **Stap 3: Commit**

```bash
git add src/db/schema/auth.ts
git commit -m "feat: voeg auth-schema toe met pgSchema('auth') voor Better Auth tabellen"
```

---

### Task 2: src/db/schema/rbac.ts — Rollen en permissies in `rbac` schema

**Files:**
- Create: `src/db/schema/rbac.ts`

- [ ] **Stap 1: Schrijf het nieuwe bestand**

```typescript
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
```

- [ ] **Stap 2: Verifieer TypeScript-compilatie**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Verwacht: geen nieuwe fouten in `src/db/schema/rbac.ts`.

- [ ] **Stap 3: Commit**

```bash
git add src/db/schema/rbac.ts
git commit -m "feat: voeg rbac-schema toe met rollen, permissies en role_permissions"
```

---

### Task 3: src/db/schema/iam.ts — Tenants en leden in `iam` schema

**Files:**
- Create: `src/db/schema/iam.ts`

Let op: importeert `users` uit `./auth` en `roles` uit `./rbac`. Geen circulaire afhankelijkheden.

- [ ] **Stap 1: Schrijf het nieuwe bestand**

```typescript
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
```

- [ ] **Stap 2: Verifieer TypeScript-compilatie**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Verwacht: geen nieuwe fouten in `src/db/schema/iam.ts`.

- [ ] **Stap 3: Commit**

```bash
git add src/db/schema/iam.ts
git commit -m "feat: voeg iam-schema toe met tenants en tenant_members"
```

---

### Task 4: src/db/schema/app.ts — Domein-tabellen in `app` schema

**Files:**
- Create: `src/db/schema/app.ts`

Importeert `tenants` uit `./iam` en `users` uit `./auth`.

- [ ] **Stap 1: Schrijf het nieuwe bestand**

```typescript
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
```

- [ ] **Stap 2: Verifieer TypeScript-compilatie**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Verwacht: geen nieuwe fouten in `src/db/schema/app.ts`.

- [ ] **Stap 3: Commit**

```bash
git add src/db/schema/app.ts
git commit -m "feat: voeg app-schema toe met domein-tabellen (assistants, runs, events, reviews, integrations)"
```

---

### Task 5: Barrel-bestand + config-updates

**Files:**
- Create: `src/db/schema/index.ts`
- Modify: `drizzle.config.ts`
- Modify: `src/db/index.ts`

- [ ] **Stap 1: Maak de barrel aan**

```typescript
// src/db/schema/index.ts
// Re-exporteert alles voor backwards-compatibiliteit met bestaande imports
export * from './auth'
export * from './iam'
export * from './rbac'
export * from './app'
```

- [ ] **Stap 2: Update drizzle.config.ts**

Vervang:
```typescript
schema: './src/db/schema.ts',
```
Door:
```typescript
schema: './src/db/schema/index.ts',
```

- [ ] **Stap 3: Update src/db/index.ts — combineer alle subschema's**

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as authSchema from './schema/auth'
import * as iamSchema from './schema/iam'
import * as rbacSchema from './schema/rbac'
import * as appSchema from './schema/app'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) {
  throw new Error('DATABASE_URL omgevingsvariabele is niet ingesteld')
}

const client = postgres(connectionString)
export const db = drizzle(client, {
  schema: { ...authSchema, ...iamSchema, ...rbacSchema, ...appSchema },
})
```

- [ ] **Stap 4: Verifieer compilatie (nieuwe bestanden, oud schema.ts nog aanwezig)**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Verwacht: geen fouten in de nieuw aangemaakte bestanden.

- [ ] **Stap 5: Commit**

```bash
git add src/db/schema/index.ts drizzle.config.ts src/db/index.ts
git commit -m "feat: voeg barrel-bestand toe en update drizzle config naar multi-schema structuur"
```

---

### Task 6: Update src/lib/auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Stap 1: Vervang de import**

Vervang:
```typescript
import { users, sessions, accounts, verifications } from '@/db/schema'
```
Door:
```typescript
import { users, sessions, accounts, verifications } from '@/db/schema/auth'
```

Het bestand ziet er daarna zo uit:

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { db } from '@/db'
import { users, sessions, accounts, verifications } from '@/db/schema/auth'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
        console.log(`[Magic Link] ${email}: ${url}`)
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Stap 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix: update Better Auth import naar @/db/schema/auth subpad"
```

---

### Task 7: Update consumerende bestanden (API routes + settings page)

**Files:**
- Modify: `src/app/api/events/analytics/route.ts`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/assistants/route.ts`
- Modify: `src/app/api/assistants/[id]/route.ts`
- Modify: `src/app/api/review/route.ts`
- Modify: `src/app/api/review/[id]/route.ts`
- Modify: `src/app/api/dashboard/metrics/route.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Stap 1: Update alle bestanden (één voor één)**

`src/app/api/events/analytics/route.ts` — vervang:
```typescript
import { assistantEvents } from '@/db/schema'
```
door:
```typescript
import { assistantEvents } from '@/db/schema/app'
```

`src/app/api/events/route.ts` — vervang:
```typescript
import { assistantEvents } from '@/db/schema'
```
door:
```typescript
import { assistantEvents } from '@/db/schema/app'
```

`src/app/api/assistants/route.ts` — vervang:
```typescript
import { assistants } from '@/db/schema'
```
door:
```typescript
import { assistants } from '@/db/schema/app'
```

`src/app/api/assistants/[id]/route.ts` — vervang:
```typescript
import { assistants } from '@/db/schema'
```
door:
```typescript
import { assistants } from '@/db/schema/app'
```

`src/app/api/review/route.ts` — vervang:
```typescript
import { reviewItems } from '@/db/schema'
```
door:
```typescript
import { reviewItems } from '@/db/schema/app'
```

`src/app/api/review/[id]/route.ts` — vervang:
```typescript
import { reviewItems } from '@/db/schema'
```
door:
```typescript
import { reviewItems } from '@/db/schema/app'
```

`src/app/api/dashboard/metrics/route.ts` — vervang:
```typescript
import { assistants, assistantRuns, reviewItems } from '@/db/schema'
```
door:
```typescript
import { assistants, assistantRuns, reviewItems } from '@/db/schema/app'
```

`src/app/(dashboard)/settings/page.tsx` — vervang:
```typescript
import { assistants, tenants } from '@/db/schema'
```
door:
```typescript
import { assistants } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
```

- [ ] **Stap 2: Commit**

```bash
git add \
  src/app/api/events/analytics/route.ts \
  src/app/api/events/route.ts \
  src/app/api/assistants/route.ts \
  "src/app/api/assistants/[id]/route.ts" \
  src/app/api/review/route.ts \
  "src/app/api/review/[id]/route.ts" \
  src/app/api/dashboard/metrics/route.ts \
  "src/app/(dashboard)/settings/page.tsx"
git commit -m "fix: update schema-imports naar subschema-paden (app/iam/auth)"
```

---

### Task 8: Verwijder src/db/schema.ts en verifieer TypeScript

**Files:**
- Delete: `src/db/schema.ts`

- [ ] **Stap 1: Controleer of nog bestanden het oude pad importeren**

```bash
grep -r "from '@/db/schema'" src/ --include="*.ts" --include="*.tsx"
```

Verwacht: geen resultaten. Als er nog resultaten zijn, pas die bestanden eerst aan (zie Task 7).

- [ ] **Stap 2: Verwijder het oude schema-bestand**

```bash
rm src/db/schema.ts
```

- [ ] **Stap 3: Verifieer TypeScript-compilatie (volledige project)**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```

Verwacht: geen fouten. Als er fouten zijn, lees de foutmelding — het gaat dan om een import die Task 7 miste.

- [ ] **Stap 4: Commit**

```bash
git add -u src/db/schema.ts
git commit -m "refactor: verwijder oude flat schema.ts, volledig vervangen door src/db/schema/*"
```

---

### Task 9: src/types/index.ts — Permission type toevoegen

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Stap 1: Voeg Permission type toe**

Voeg onderaan het bestand toe (na de bestaande exports):

```typescript
// RBAC-permissie types
export const PermissionResource = {
  ASSISTANTS: 'assistants',
  INTEGRATIONS: 'integrations',
  TENANT: 'tenant',
} as const
export type PermissionResource = (typeof PermissionResource)[keyof typeof PermissionResource]

export const PermissionAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  TOGGLE_STATUS: 'toggle_status',
  UPDATE_PLAN: 'update_plan',
  INVITE_USER: 'invite_user',
  REMOVE_USER: 'remove_user',
  UPDATE_MEMBER_ROLE: 'update_member_role',
} as const
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction]
```

- [ ] **Stap 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: voeg PermissionResource en PermissionAction types toe"
```

---

### Task 10: SQL-migratie 0004_schema_split_rbac.sql

**Files:**
- Create: `src/db/migrations/0004_schema_split_rbac.sql`
- Modify: `src/db/migrations/meta/_journal.json`

- [ ] **Stap 1: Schrijf de migratie**

```sql
-- src/db/migrations/0004_schema_split_rbac.sql
-- Atomische migratie: verplaats bestaande tabellen naar logische schemas
-- en voeg RBAC-tabellen toe.

--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS auth;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS iam;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS rbac;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;

-- ─── Auth schema ──────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."users" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "auth"."users" DROP COLUMN IF EXISTS "role";
--> statement-breakpoint
ALTER TABLE "public"."sessions" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "public"."accounts" SET SCHEMA auth;
--> statement-breakpoint
ALTER TABLE "public"."verifications" SET SCHEMA auth;

-- ─── IAM schema ───────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."tenants" SET SCHEMA iam;
--> statement-breakpoint
ALTER TABLE "public"."tenant_users" RENAME TO "tenant_members";
--> statement-breakpoint
ALTER TABLE "public"."tenant_members" SET SCHEMA iam;
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD COLUMN IF NOT EXISTS "joined_at" timestamp NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD CONSTRAINT "tenant_members_pk" PRIMARY KEY ("tenant_id", "user_id");

-- ─── App schema ───────────────────────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "public"."assistants" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."assistant_runs" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."assistant_events" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."review_items" SET SCHEMA app;
--> statement-breakpoint
ALTER TABLE "public"."integrations" SET SCHEMA app;

-- ─── RBAC schema: tabellen aanmaken ───────────────────────────────────────────
--> statement-breakpoint
CREATE TABLE "rbac"."roles" (
  "id"          text PRIMARY KEY,
  "description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac"."permissions" (
  "id"          text PRIMARY KEY,
  "resource"    text NOT NULL,
  "action"      text NOT NULL,
  "description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac"."role_permissions" (
  "role_id"       text NOT NULL REFERENCES "rbac"."roles"("id") ON DELETE CASCADE,
  "permission_id" text NOT NULL REFERENCES "rbac"."permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_id")
);

-- ─── FK voor tenant_members.role ──────────────────────────────────────────────
--> statement-breakpoint
ALTER TABLE "iam"."tenant_members"
  ADD CONSTRAINT "tenant_members_role_fk"
  FOREIGN KEY ("role") REFERENCES "rbac"."roles"("id");

-- ─── RBAC seed-data ───────────────────────────────────────────────────────────
--> statement-breakpoint
INSERT INTO "rbac"."roles" ("id", "description") VALUES
  ('admin',  'Volledige toegang tot alle functies'),
  ('member', 'Alleen-lezen toegang tot assistenten, integraties en tenant-info');

--> statement-breakpoint
INSERT INTO "rbac"."permissions" ("id", "resource", "action", "description") VALUES
  ('assistants.create',         'assistants',   'create',              'Assistent aanmaken'),
  ('assistants.read',           'assistants',   'read',                'Assistenten bekijken'),
  ('assistants.update',         'assistants',   'update',              'Assistent bewerken'),
  ('assistants.delete',         'assistants',   'delete',              'Assistent verwijderen'),
  ('assistants.toggle_status',  'assistants',   'toggle_status',       'Assistent activeren of pauzeren'),
  ('integrations.read',         'integrations', 'read',                'Integraties bekijken'),
  ('integrations.create',       'integrations', 'create',              'Integratie aanmaken'),
  ('integrations.update',       'integrations', 'update',              'Integratie bewerken'),
  ('integrations.delete',       'integrations', 'delete',              'Integratie verwijderen'),
  ('tenant.read',               'tenant',       'read',                'Tenant-info bekijken'),
  ('tenant.update_plan',        'tenant',       'update_plan',         'Abonnement wijzigen'),
  ('tenant.delete',             'tenant',       'delete',              'Tenant verwijderen'),
  ('tenant.invite_user',        'tenant',       'invite_user',         'Gebruiker uitnodigen'),
  ('tenant.remove_user',        'tenant',       'remove_user',         'Gebruiker verwijderen'),
  ('tenant.update_member_role', 'tenant',       'update_member_role',  'Rol van lid wijzigen');

--> statement-breakpoint
INSERT INTO "rbac"."role_permissions" ("role_id", "permission_id")
SELECT 'admin', "id" FROM "rbac"."permissions";

--> statement-breakpoint
INSERT INTO "rbac"."role_permissions" ("role_id", "permission_id") VALUES
  ('member', 'assistants.read'),
  ('member', 'integrations.read'),
  ('member', 'tenant.read');
```

- [ ] **Stap 2: Voeg entry toe aan Drizzle journal**

Open `src/db/migrations/meta/_journal.json` en voeg toe aan de `entries` array:

```json
{
  "idx": 4,
  "version": "7",
  "when": 1776238800000,
  "tag": "0004_schema_split_rbac",
  "breakpoints": true
}
```

Het volledige `_journal.json` ziet er daarna zo uit:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1776050948197,
      "tag": "0000_handy_scorpion",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1776081058399,
      "tag": "0001_modern_sabra",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "7",
      "when": 1776084517174,
      "tag": "0002_robust_wendell_vaughn",
      "breakpoints": true
    },
    {
      "idx": 3,
      "version": "7",
      "when": 1776169583555,
      "tag": "0003_youthful_scarecrow",
      "breakpoints": true
    },
    {
      "idx": 4,
      "version": "7",
      "when": 1776238800000,
      "tag": "0004_schema_split_rbac",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Stap 3: Commit**

```bash
git add src/db/migrations/0004_schema_split_rbac.sql src/db/migrations/meta/_journal.json
git commit -m "feat: voeg SQL-migratie 0004 toe voor schema-split en RBAC seed"
```

---

### Task 11: src/db/seed-rbac.ts — Standalone seed script

**Files:**
- Create: `src/db/seed-rbac.ts`

Dit script is idempotent via `ON CONFLICT DO NOTHING`. Handig voor nieuwe omgevingen.

- [ ] **Stap 1: Schrijf het seed-script**

```typescript
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
```

- [ ] **Stap 2: Commit**

```bash
git add src/db/seed-rbac.ts
git commit -m "feat: voeg idempotent seed-script toe voor RBAC rollen en permissies"
```

---

### Task 12: src/lib/permissions.ts — canDo() helper

**Files:**
- Create: `src/lib/permissions.ts`

- [ ] **Stap 1: Schrijf de helper**

```typescript
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
```

- [ ] **Stap 2: Verifieer TypeScript-compilatie**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: voeg canDo() permissiecheck helper toe met drie-table join"
```

---

### Task 13: Migratie uitvoeren en verifiëren

**Files:** (geen codewijzigingen)

- [ ] **Stap 1: Controleer dat DATABASE_URL ingesteld is**

```bash
echo $DATABASE_URL | cut -c1-30
```

Verwacht: begint met `postgres://` of `postgresql://`.

- [ ] **Stap 2: Voer de migratie uit**

```bash
npm run db:migrate
```

Verwacht output (ongeveer):
```
Applying migration 0004_schema_split_rbac
Migration applied successfully
```

- [ ] **Stap 3: Verifieer de schema-structuur in de database**

```bash
npx tsx -e "
const { db } = require('./src/db/index.ts');
const { sql } = require('drizzle-orm');
const res = await db.execute(sql\`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema IN ('auth','iam','rbac','app')
  ORDER BY table_schema, table_name
\`);
console.table(res.rows);
process.exit(0);
"
```

Verwacht: 16 rijen — de tabellen verdeeld over de vier schemas.

- [ ] **Stap 4: Verifieer RBAC seed-data**

```bash
npx tsx -e "
const { db } = require('./src/db/index.ts');
const { roles, permissions, rolePermissions } = require('./src/db/schema/rbac.ts');
const r = await db.select().from(roles);
const p = await db.select().from(permissions);
const rp = await db.select().from(rolePermissions);
console.log('Roles:', r.length, '(verwacht 2)');
console.log('Permissions:', p.length, '(verwacht 15)');
console.log('RolePermissions:', rp.length, '(verwacht 18)');
process.exit(0);
"
```

Verwacht: Roles: 2, Permissions: 15, RolePermissions: 18.

- [ ] **Stap 5: TypeScript volledige project-check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```

Verwacht: geen fouten.

- [ ] **Stap 6: Eindbericht**

```bash
git log --oneline -8
```

Verwacht: de 8 commits van dit plan in chronologische volgorde.

---

## Spec-coverage check

| Spec-sectie                                | Gedekt in task |
|--------------------------------------------|----------------|
| `auth.*` tabellen met pgSchema             | Task 1         |
| `rbac.*` tabellen met pgSchema             | Task 2         |
| `iam.*` tabellen met pgSchema              | Task 3         |
| `app.*` tabellen met pgSchema              | Task 4         |
| Better Auth drizzleAdapter met subpad      | Task 5 + 6     |
| Import-updates codebase (9 bestanden)      | Task 6 + 7     |
| Verwijdering van `users.role` kolom        | Task 10 (SQL)  |
| `tenant_users` → `tenant_members` rename   | Task 10 (SQL)  |
| `joined_at` kolom in `tenant_members`      | Task 10 (SQL)  |
| Composite PK op `tenant_members`           | Task 10 (SQL)  |
| RBAC seed-data (2 rollen, 15 permissies)   | Task 10 + 11   |
| `canDo()` helper met 3-table join          | Task 12        |
| `PermissionResource` / `PermissionAction`  | Task 9         |

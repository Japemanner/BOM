# RBAC & Auth Schema Design

**Datum:** 2026-04-15  
**Status:** Goedgekeurd, klaar voor implementatie

---

## Doel

Het huidige `public` PostgreSQL schema bevat Better Auth tabellen, tenancy-logica en domeindata ongesorteerd door elkaar. Dit ontwerp splitst alles op in vier logisch gescheiden PostgreSQL schemas, voegt een expliciete RBAC-laag toe en behoudt volledige compatibiliteit met Better Auth.

## Architectuur

Vier PostgreSQL schemas, elk met één verantwoordelijkheid:

| Schema | Verantwoordelijkheid |
|--------|----------------------|
| `auth` | Better Auth tabellen: identiteit, sessies, tokens |
| `iam`  | Tenancy: welke gebruiker zit in welke tenant, met welke rol |
| `rbac` | Rollen en permissies: wat mag welke rol doen |
| `app`  | Business domein: assistenten, runs, events, integraties |

## Tabelspecificatie

### auth schema

```sql
auth.users (
  id              text PRIMARY KEY,          -- Better Auth text ID
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  email_verified  boolean NOT NULL DEFAULT false,
  image           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
)
-- Verwijdering t.o.v. huidig: role kolom verdwijnt (zit nu in iam.tenant_members)

auth.sessions (
  id          text PRIMARY KEY,
  expires_at  timestamptz NOT NULL,
  token       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  ip_address  text,
  user_agent  text,
  user_id     text NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
)

auth.accounts (
  id                        text PRIMARY KEY,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  user_id                   text NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
)

auth.verifications (
  id          text PRIMARY KEY,
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
)
```

### iam schema

```sql
iam.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  created_at  timestamptz NOT NULL DEFAULT now()
)

iam.tenant_members (
  tenant_id   uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' REFERENCES rbac.roles(id),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
)
```

### rbac schema

```sql
rbac.roles (
  id          text PRIMARY KEY,   -- 'admin' | 'member'
  description text NOT NULL
)

rbac.permissions (
  id          text PRIMARY KEY,   -- '<resource>.<action>'
  resource    text NOT NULL,      -- 'assistants' | 'integrations' | 'tenant'
  action      text NOT NULL,      -- 'create' | 'read' | 'update' | 'delete' | ...
  description text NOT NULL
)

rbac.role_permissions (
  role_id        text NOT NULL REFERENCES rbac.roles(id) ON DELETE CASCADE,
  permission_id  text NOT NULL REFERENCES rbac.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
)
```

### app schema

```sql
app.assistants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  type         text NOT NULL,
  status       text NOT NULL DEFAULT 'paused',  -- 'active' | 'paused' | 'error'
  config       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
)

app.assistant_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id  uuid NOT NULL REFERENCES app.assistants(id) ON DELETE CASCADE,
  status        text NOT NULL,  -- 'pending' | 'running' | 'success' | 'failed'
  input         jsonb NOT NULL DEFAULT '{}',
  output        jsonb NOT NULL DEFAULT '{}',
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
)

app.assistant_events (
  id              text PRIMARY KEY,  -- crypto.randomUUID()
  assistant_id    text NOT NULL,     -- geen FK: events blijven bewaard na verwijdering assistent
  assistant_name  text NOT NULL,
  event_type      text NOT NULL,     -- 'activated' | 'deactivated'
  created_at      timestamptz NOT NULL DEFAULT now()
)

app.review_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id  uuid NOT NULL REFERENCES app.assistants(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  priority      text NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high' | 'critical'
  status        text NOT NULL DEFAULT 'open',    -- 'open' | 'approved' | 'rejected' | 'ignored'
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   text REFERENCES auth.users(id)
)

app.integrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  type            text NOT NULL,    -- 'exact' | 'ms365' | 'slack' | 'ubl' | 'custom'
  status          text NOT NULL DEFAULT 'setup',  -- 'active' | 'error' | 'setup'
  config          jsonb NOT NULL DEFAULT '{}',
  last_checked_at timestamptz
)
```

## RBAC Permissiematrix

Seed-data voor `rbac.roles`, `rbac.permissions` en `rbac.role_permissions`:

| Permission ID               | Resource     | Action              | admin | member |
|-----------------------------|--------------|---------------------|:-----:|:------:|
| `assistants.create`         | assistants   | create              | ✓     |        |
| `assistants.read`           | assistants   | read                | ✓     | ✓      |
| `assistants.update`         | assistants   | update              | ✓     |        |
| `assistants.delete`         | assistants   | delete              | ✓     |        |
| `assistants.toggle_status`  | assistants   | toggle_status       | ✓     |        |
| `integrations.read`         | integrations | read                | ✓     | ✓      |
| `integrations.create`       | integrations | create              | ✓     |        |
| `integrations.update`       | integrations | update              | ✓     |        |
| `integrations.delete`       | integrations | delete              | ✓     |        |
| `tenant.read`               | tenant       | read                | ✓     | ✓      |
| `tenant.update_plan`        | tenant       | update_plan         | ✓     |        |
| `tenant.delete`             | tenant       | delete              | ✓     |        |
| `tenant.invite_user`        | tenant       | invite_user         | ✓     |        |
| `tenant.remove_user`        | tenant       | remove_user         | ✓     |        |
| `tenant.update_member_role` | tenant       | update_member_role  | ✓     |        |

Members hebben 3 permissies: `assistants.read`, `integrations.read`, `tenant.read`.  
Admins hebben alle 15 permissies.

## Better Auth Integratie

Better Auth's `drizzleAdapter` ontvangt directe Drizzle-tabelreferenties. Geen `tablePrefix` nodig — de adapter werkt met objecten, niet met namen:

```typescript
// src/lib/auth.ts
import { users, sessions, accounts, verifications } from '@/db/schema/auth'

database: drizzleAdapter(db, {
  provider: 'pg',
  schema: {
    user: users,          // auth.users
    session: sessions,    // auth.sessions
    account: accounts,    // auth.accounts
    verification: verifications,
  },
})
```

## Permissiecheck helper

```typescript
// src/lib/permissions.ts
export async function canDo(
  userId: string,
  tenantId: string,
  resource: string,
  action: string
): Promise<boolean>
```

Query: `iam.tenant_members` JOIN `rbac.role_permissions` JOIN `rbac.permissions` — drie joins, één boolean resultaat.

## Bestandsstructuur na implementatie

```
src/db/
  schema/
    auth.ts        ← auth.users, sessions, accounts, verifications
    iam.ts         ← iam.tenants, tenant_members
    rbac.ts        ← rbac.roles, permissions, role_permissions
    app.ts         ← app.assistants, runs, events, review_items, integrations
    index.ts       ← re-exporteert alles voor backwards compat
  index.ts         ← drizzle() met gecombineerd schema
  seed-rbac.ts     ← insert roles + permissions + role_permissions
src/lib/
  auth.ts          ← bijgewerkte Better Auth config
  permissions.ts   ← canDo() helper (nieuw)
src/db/migrations/
  0004_schema_split_rbac.sql  ← één migratie
```

## Migratiestrategie

Één atomische SQL-migratie (`0004_schema_split_rbac.sql`):

1. `CREATE SCHEMA auth, iam, rbac, app`
2. `ALTER TABLE public.users SET SCHEMA auth` + `DROP COLUMN role`
3. `ALTER TABLE public.sessions/accounts/verifications SET SCHEMA auth`
4. `ALTER TABLE public.tenants SET SCHEMA iam`
5. `ALTER TABLE public.tenant_users RENAME TO tenant_members` → `SET SCHEMA iam` + `ADD COLUMN joined_at`
6. `ALTER TABLE public.assistants/assistant_runs/assistant_events/review_items/integrations SET SCHEMA app`
7. `CREATE TABLE rbac.roles/permissions/role_permissions`
8. `INSERT` seed-data voor RBAC

PostgreSQL hernoemt bestaande FK-constraints automatisch bij `SET SCHEMA` — geen handmatig FK-werk.

## Wijzigingen in bestaande code

- `src/db/schema.ts` → opsplitsen naar `src/db/schema/*.ts`
- Imports door de codebase: `from '@/db/schema'` → `from '@/db/schema/app'` (of iam/auth/rbac)
- `src/types/index.ts`: `UserRole` uitbreiden met permissie-types
- API routes: `canDo()` aanroepen voor schrijfoperaties

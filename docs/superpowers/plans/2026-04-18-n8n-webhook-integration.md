# N8N Webhook Integratie — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bidirectionele N8N koppeling: inbound Bearer-token webhooks maken review items aan, outbound AI-run output wordt naar N8N gestuurd met een encrypted token.

**Architecture:** Nieuwe `app.webhook_tokens` tabel voor inbound auth (SHA-256 gehashte tokens per tenant). AES-256-GCM encrypted outbound tokens worden per assistent opgeslagen. Bij een POST op `/api/assistant-runs` met output én webhook_url wordt de N8N webhook fire-and-forget aangeroepen.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM 0.45, Node.js `crypto` (AES-256-GCM + SHA-256), Playwright E2E, PostgreSQL multi-schema (`app.*`, `iam.*`, `rbac.*`).

---

## Bestandsstructuur

| Actie | Pad | Verantwoordelijkheid |
|-------|-----|----------------------|
| Create | `src/db/migrations/0005_webhook_tokens.sql` | DB-schema + RBAC seed |
| Modify | `src/db/schema/app.ts` | Drizzle `webhookTokens` tabel + 2 kolommen op `assistants` |
| Modify | `src/types/index.ts` | `webhooks` toevoegen aan `PermissionResource`, `manage` aan `PermissionAction` |
| Modify | `src/db/seed-rbac.ts` | `webhooks.manage` permissie + admin toewijzing |
| Create | `src/lib/crypto.ts` | `encrypt()` + `decrypt()` via AES-256-GCM |
| Create | `src/app/api/webhooks/inbound/route.ts` | POST inbound van N8N → review item |
| Create | `src/app/api/webhooks/tokens/route.ts` | GET lijst + POST nieuw token |
| Create | `src/app/api/webhooks/tokens/[id]/route.ts` | DELETE token |
| Create | `src/app/api/assistant-runs/route.ts` | POST run aanmaken + outbound webhook |
| Modify | `src/app/api/assistants/[id]/route.ts` | PATCH accepteert `webhookUrl` + `webhookToken` |
| Create | `src/components/settings/webhook-tokens.tsx` | UI: tokenbeheer in Admin tab |
| Modify | `src/components/settings/settings-tabs.tsx` | Admin tab uitgebreid met webhook tokens sectie |
| Modify | `src/app/(dashboard)/settings/page.tsx` | Fetch webhook tokens, doorsturen naar component |
| Modify | `src/components/settings/admin-assistants.tsx` | Edit modal: webhookUrl + masked token veld |
| Create | `e2e/webhook-tokens.spec.ts` | E2E tests voor token UI |

---

## Task 1: SQL-migratie + Drizzle schema

**Files:**
- Create: `src/db/migrations/0005_webhook_tokens.sql`
- Modify: `src/db/schema/app.ts`

- [ ] **Stap 1: Maak migratiebestand aan**

```sql
-- src/db/migrations/0005_webhook_tokens.sql
CREATE TABLE app.webhook_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  created_at    timestamp NOT NULL DEFAULT now(),
  last_used_at  timestamp
);

ALTER TABLE app.assistants
  ADD COLUMN webhook_url             text,
  ADD COLUMN webhook_token_encrypted text;

INSERT INTO rbac.permissions (id, resource, action, description)
VALUES ('webhooks.manage', 'webhooks', 'manage', 'Webhook tokens beheren')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id)
VALUES ('admin', 'webhooks.manage')
ON CONFLICT DO NOTHING;
```

- [ ] **Stap 2: Bereken SHA-256 hash van het migratiebestand**

```bash
node -e "const fs=require('fs');const crypto=require('crypto');const content=fs.readFileSync('src/db/migrations/0005_webhook_tokens.sql','utf8');console.log(crypto.createHash('sha256').update(content).digest('hex'))"
```

Noteer de hash — nodig voor stap 3.

- [ ] **Stap 3: Voeg entry toe aan Drizzle journal**

Open `src/db/migrations/meta/_journal.json`. Voeg onderaan (voor het afsluitende `]`) toe:

```json
{
  "idx": 5,
  "version": "7",
  "when": 1745008800000,
  "tag": "0005_webhook_tokens",
  "breakpoints": true
}
```

- [ ] **Stap 4: Voeg `webhookTokens` tabel toe aan `src/db/schema/app.ts`**

Voeg na de import-sectie en `appSchema` definitie toe — na de `integrations` tabel:

```typescript
export const webhookTokens = appSchema.table('webhook_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})
```

- [ ] **Stap 5: Voeg twee kolommen toe aan de `assistants` tabel definitie in `app.ts`**

Voeg onderaan de kolommen van de `assistants` tabel toe (na `updatedAt`):

```typescript
  webhookUrl: text('webhook_url'),
  webhookTokenEncrypted: text('webhook_token_encrypted'),
```

- [ ] **Stap 6: Controleer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

Verwacht: geen nieuwe fouten (er zijn 3 pre-existing fouten die je kunt negeren).

- [ ] **Stap 7: Commit**

```bash
git add src/db/migrations/0005_webhook_tokens.sql src/db/migrations/meta/_journal.json src/db/schema/app.ts
git commit -m "feat: voeg webhook_tokens migratie en Drizzle schema toe"
```

---

## Task 2: `src/lib/crypto.ts`

**Files:**
- Create: `src/lib/crypto.ts`

- [ ] **Stap 1: Maak het bestand aan**

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY moet 64 hex-tekens zijn (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Ongeldig versleuteld formaat')
  const [ivHex, tagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

- [ ] **Stap 2: Genereer een testsleutel en verifieer encrypt/decrypt**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && node -e "
const key = require('crypto').randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = key;
const { encrypt, decrypt } = require('./src/lib/crypto.ts');
" 2>&1 || node --loader ts-node/esm -e "
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
" 2>&1 | head -5
```

Snellere verificatie via tsx:

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npx tsx -e "
import { encrypt, decrypt } from './src/lib/crypto.ts';
const msg = 'test-token-abc123';
const enc = encrypt(msg);
const dec = decrypt(enc);
console.log('OK:', dec === msg, '| encrypted length:', enc.length);
"
```

Verwacht: `OK: true | encrypted length: <getal>`

- [ ] **Stap 3: Voeg `ENCRYPTION_KEY` toe aan `.env.local`**

```bash
echo "ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))')" >> ".env.local"
```

Of open `.env.local` en voeg handmatig toe:
```
ENCRYPTION_KEY=<uitvoer van: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

- [ ] **Stap 4: Commit**

```bash
git add src/lib/crypto.ts
git commit -m "feat: voeg AES-256-GCM encrypt/decrypt helper toe"
```

---

## Task 3: Types + RBAC seed uitbreiden

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db/seed-rbac.ts`

- [ ] **Stap 1: Voeg `webhooks` toe aan `PermissionResource` in `src/types/index.ts`**

Zoek de `PermissionResource` definitie (rond regel 60) en voeg `WEBHOOKS` toe:

```typescript
export const PermissionResource = {
  ASSISTANTS: 'assistants',
  INTEGRATIONS: 'integrations',
  TENANT: 'tenant',
  WEBHOOKS: 'webhooks',
} as const
export type PermissionResource = (typeof PermissionResource)[keyof typeof PermissionResource]
```

- [ ] **Stap 2: Voeg `manage` toe aan `PermissionAction` in `src/types/index.ts`**

Zoek `PermissionAction` en voeg `MANAGE` toe:

```typescript
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
  MANAGE: 'manage',
} as const
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction]
```

- [ ] **Stap 3: Breid `PERMISSIONS` array uit in `src/db/seed-rbac.ts`**

Voeg onderaan de `PERMISSIONS` array toe:

```typescript
  { id: 'webhooks.manage', resource: 'webhooks', action: 'manage', description: 'Webhook tokens beheren' },
```

- [ ] **Stap 4: Voeg toe aan `ROLE_PERMISSIONS` in `src/db/seed-rbac.ts`**

De admin-permissies worden al automatisch toegevoegd via `...PERMISSIONS.map(...)` — geen extra regel nodig. Controleer dat dit klopt:

```typescript
// Admin: alle permissies (inclusief nieuwe webhooks.manage)
...PERMISSIONS.map((p) => ({ roleId: 'admin', permissionId: p.id })),
```

Dit werkt correct — geen actie vereist.

- [ ] **Stap 5: Controleer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 6: Commit**

```bash
git add src/types/index.ts src/db/seed-rbac.ts
git commit -m "feat: voeg webhooks.manage permissie toe aan types en seed"
```

---

## Task 4: POST `/api/webhooks/inbound` — inbound van N8N

**Files:**
- Create: `src/app/api/webhooks/inbound/route.ts`

- [ ] **Stap 1: Maak de directory aan en schrijf de route**

```typescript
// src/app/api/webhooks/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens, reviewItems } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { z } from 'zod'

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Ongeautoriseerd' }, { status: 401 })
  }
  const plaintext = auth.slice(7)
  const tokenHash = createHash('sha256').update(plaintext).digest('hex')

  let tokenRecord: { id: string; tenantId: string } | undefined
  try {
    const [found] = await db
      .select({ id: webhookTokens.id, tenantId: webhookTokens.tenantId })
      .from(webhookTokens)
      .where(eq(webhookTokens.tokenHash, tokenHash))
      .limit(1)
    tokenRecord = found
  } catch (error) {
    console.error('[webhooks/inbound DB]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }

  if (!tokenRecord) {
    return NextResponse.json({ error: 'Ongeldig token' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ongeldige invoer', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { assistantId, title, description, priority } = parsed.data

  try {
    const [item] = await db
      .insert(reviewItems)
      .values({ assistantId, tenantId: tokenRecord.tenantId, title, description, priority })
      .returning({ id: reviewItems.id })

    await db
      .update(webhookTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhookTokens.id, tokenRecord.id))

    return NextResponse.json({ id: item.id, ok: true }, { status: 201 })
  } catch (error) {
    console.error('[webhooks/inbound INSERT]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 2: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 3: Handmatige API-test (na migratie in Task 10)**

```bash
# Eerst een token aanmaken via POST /api/webhooks/tokens (zie Task 5)
# Dan testen:
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Authorization: Bearer <plaintext-token>" \
  -H "Content-Type: application/json" \
  -d '{"assistantId":"<uuid>","title":"Test review item","priority":"medium"}'
# Verwacht: {"id":"<uuid>","ok":true} met status 201

curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Authorization: Bearer verkeerd-token" \
  -H "Content-Type: application/json" \
  -d '{"assistantId":"<uuid>","title":"Test"}'
# Verwacht: {"error":"Ongeldig token"} met status 401
```

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/webhooks/inbound/route.ts
git commit -m "feat: voeg inbound webhook endpoint toe voor N8N → BOM"
```

---

## Task 5: Token management routes

**Files:**
- Create: `src/app/api/webhooks/tokens/route.ts`
- Create: `src/app/api/webhooks/tokens/[id]/route.ts`

- [ ] **Stap 1: Schrijf GET + POST route**

```typescript
// src/app/api/webhooks/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const tokens = await db
      .select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      })
      .from(webhookTokens)
      .where(eq(webhookTokens.tenantId, DEMO_TENANT_ID))
      .orderBy(webhookTokens.createdAt)

    return NextResponse.json(tokens)
  } catch (error) {
    console.error('[webhooks/tokens GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = createTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const plaintext = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plaintext).digest('hex')

    const [token] = await db
      .insert(webhookTokens)
      .values({ tenantId: DEMO_TENANT_ID, name: parsed.data.name, tokenHash })
      .returning({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
      })

    return NextResponse.json({ ...token, token: plaintext }, { status: 201 })
  } catch (error) {
    console.error('[webhooks/tokens POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 2: Schrijf DELETE route**

```typescript
// src/app/api/webhooks/tokens/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [deleted] = await db
      .delete(webhookTokens)
      .where(and(eq(webhookTokens.id, id), eq(webhookTokens.tenantId, DEMO_TENANT_ID)))
      .returning({ id: webhookTokens.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[webhooks/tokens/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 3: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 4: Handmatige test (na migratie)**

```bash
# Token aanmaken
curl -X POST http://localhost:3000/api/webhooks/tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"N8N productie"}'
# Verwacht: {"id":"...","name":"N8N productie","createdAt":"...","token":"<64 hex chars>"}

# Tokens opvragen
curl http://localhost:3000/api/webhooks/tokens
# Verwacht: array met 1 token (zonder plaintext)

# Token verwijderen
curl -X DELETE http://localhost:3000/api/webhooks/tokens/<id>
# Verwacht: 204 No Content
```

- [ ] **Stap 5: Commit**

```bash
git add src/app/api/webhooks/tokens/route.ts "src/app/api/webhooks/tokens/[id]/route.ts"
git commit -m "feat: voeg webhook token management API routes toe"
```

---

## Task 6: POST `/api/assistant-runs` met outbound webhook

**Files:**
- Create: `src/app/api/assistant-runs/route.ts`

- [ ] **Stap 1: Schrijf de route**

```typescript
// src/app/api/assistant-runs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { RunStatus } from '@/types'

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  status: z.enum([
    RunStatus.PENDING,
    RunStatus.RUNNING,
    RunStatus.SUCCESS,
    RunStatus.FAILED,
  ]).default(RunStatus.SUCCESS),
  input: z.record(z.unknown()).default({}),
  output: z.string().optional(),
  durationMs: z.number().int().positive().optional(),
})

async function fireOutboundWebhook(
  webhookUrl: string,
  webhookTokenEncrypted: string,
  payload: {
    runId: string
    assistantId: string
    assistantName: string
    output: string
    timestamp: string
  }
): Promise<void> {
  try {
    const token = decrypt(webhookTokenEncrypted)
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[assistant-runs outbound webhook mislukt]', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { assistantId, status, input, output, durationMs } = parsed.data

    const [run] = await db
      .insert(assistantRuns)
      .values({
        assistantId,
        status,
        input,
        output: output ? { text: output } : {},
        durationMs,
      })
      .returning()

    if (output) {
      const [assistant] = await db
        .select({
          name: assistants.name,
          webhookUrl: assistants.webhookUrl,
          webhookTokenEncrypted: assistants.webhookTokenEncrypted,
        })
        .from(assistants)
        .where(eq(assistants.id, assistantId))
        .limit(1)

      if (assistant?.webhookUrl && assistant.webhookTokenEncrypted) {
        void fireOutboundWebhook(assistant.webhookUrl, assistant.webhookTokenEncrypted, {
          runId: run.id,
          assistantId,
          assistantName: assistant.name,
          output,
          timestamp: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json(run, { status: 201 })
  } catch (error) {
    console.error('[assistant-runs POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 2: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 3: Handmatige test (na migratie)**

```bash
# Run zonder output — geen webhook
curl -X POST http://localhost:3000/api/assistant-runs \
  -H "Content-Type: application/json" \
  -d '{"assistantId":"<uuid>","status":"success","input":{}}'
# Verwacht: run object met status 201

# Run met output — webhook triggert (alleen als assistent webhook_url heeft)
curl -X POST http://localhost:3000/api/assistant-runs \
  -H "Content-Type: application/json" \
  -d '{"assistantId":"<uuid>","status":"success","input":{},"output":"Factuur verwerkt: €1250"}'
# Verwacht: run object — check server logs voor eventuele webhook fouten
```

- [ ] **Stap 4: Commit**

```bash
git add src/app/api/assistant-runs/route.ts
git commit -m "feat: voeg assistant-runs route toe met outbound N8N webhook"
```

---

## Task 7: PATCH `/api/assistants/[id]` — webhook velden accepteren

**Files:**
- Modify: `src/app/api/assistants/[id]/route.ts`

- [ ] **Stap 1: Breid `patchSchema` uit met webhook velden**

Zoek de `patchSchema` definitie in `src/app/api/assistants/[id]/route.ts` en vervang deze:

```typescript
import { encrypt } from '@/lib/crypto'

const patchSchema = z.object({
  status: z.enum([
    AssistantStatus.ACTIVE,
    AssistantStatus.PAUSED,
    AssistantStatus.ERROR,
  ]).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  type: z.string().min(1).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  webhookToken: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Geen velden om te updaten' })
```

- [ ] **Stap 2: Pas de PATCH handler aan om webhook velden te verwerken**

Vervang in de PATCH handler het stuk vanaf `const [updated] = await db...`:

```typescript
    const { webhookToken, webhookUrl, ...rest } = parsed.data

    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    }
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookToken) updateData.webhookTokenEncrypted = encrypt(webhookToken)

    const [updated] = await db
      .update(assistants)
      .set(updateData)
      .where(eq(assistants.id, id))
      .returning()
```

- [ ] **Stap 3: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 4: Handmatige test (na migratie)**

```bash
curl -X PATCH http://localhost:3000/api/assistants/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://n8n.example.com/webhook/test","webhookToken":"mijn-geheim-token"}'
# Verwacht: updated assistent met webhookUrl ingevuld
# webhookTokenEncrypted is ingesteld maar wordt niet teruggegeven in response (staat wel in DB)
```

- [ ] **Stap 5: Commit**

```bash
git add src/app/api/assistants/[id]/route.ts
git commit -m "feat: PATCH assistants accepteert webhookUrl en webhookToken"
```

---

## Task 8: UI — Webhook token management (Admin tab)

**Files:**
- Create: `src/components/settings/webhook-tokens.tsx`
- Modify: `src/components/settings/settings-tabs.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Stap 1: Maak `webhook-tokens.tsx` component aan**

```typescript
// src/components/settings/webhook-tokens.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, Copy, Check, X } from 'lucide-react'

const TEAL = '#1D9E75'

interface WebhookToken {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

interface WebhookTokensProps {
  initial: WebhookToken[]
}

export function WebhookTokens({ initial }: WebhookTokensProps) {
  const [tokens, setTokens] = useState<WebhookToken[]>(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as WebhookToken & { token: string }
      setTokens((prev) => [...prev, { id: data.id, name: data.name, createdAt: data.createdAt, lastUsedAt: null }])
      setNewToken(data.token)
      setNewName('')
    } catch {
      setError('Aanmaken mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/webhooks/tokens/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTokens((prev) => prev.filter((t) => t.id !== id))
      setConfirmDelete(null)
    } catch {
      setError('Verwijderen mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #EAECEF',
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>Webhook tokens</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
            Bearer tokens voor inkomende N8N webhooks
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewToken(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px', borderRadius: 6,
            background: TEAL, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} /> Nieuw token
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{error}</p>
      )}

      {/* Nieuw token aanmaken */}
      {showCreate && !newToken && (
        <div
          style={{
            background: '#F8FAFC', border: '0.5px solid #E2E8F0',
            borderRadius: 8, padding: 14, marginBottom: 14,
            display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Token naam, bijv. 'N8N productie'"
            style={{
              flex: 1, height: 32, padding: '0 10px',
              border: '1px solid #CBD5E1', borderRadius: 6,
              fontSize: 12, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            style={{
              height: 32, padding: '0 14px', borderRadius: 6,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              opacity: loading || !newName.trim() ? 0.5 : 1,
            }}
          >
            Aanmaken
          </button>
          <button
            onClick={() => setShowCreate(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Eenmalig token tonen */}
      {newToken && (
        <div
          style={{
            background: '#F0FDF4', border: '1px solid #86EFAC',
            borderRadius: 8, padding: 14, marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: '#166534', marginBottom: 8 }}>
            Token aangemaakt — kopieer het nu. Dit token wordt niet meer getoond.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              style={{
                flex: 1, fontSize: 11, background: '#fff',
                border: '1px solid #BBF7D0', borderRadius: 4,
                padding: '6px 10px', wordBreak: 'break-all', color: '#0F172A',
              }}
            >
              {newToken}
            </code>
            <button
              onClick={handleCopy}
              style={{
                height: 32, padding: '0 12px', borderRadius: 6,
                background: copied ? '#22C55E' : TEAL, color: '#fff', border: 'none',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              {copied ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
            </button>
            <button
              onClick={() => { setNewToken(null); setShowCreate(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Token tabel */}
      {tokens.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
          Nog geen tokens aangemaakt
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #EAECEF' }}>
              {['Naam', 'Aangemaakt', 'Laatste gebruik', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left', fontSize: 11, fontWeight: 500,
                    color: '#9CA3AF', padding: '0 0 8px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} style={{ borderBottom: '0.5px solid #F1F5F9' }}>
                <td style={{ fontSize: 12, color: '#0F172A', padding: '10px 0' }}>{t.name}</td>
                <td style={{ fontSize: 12, color: '#6B7280', padding: '10px 8px' }}>
                  {formatDate(t.createdAt)}
                </td>
                <td style={{ fontSize: 12, color: '#6B7280', padding: '10px 8px' }}>
                  {t.lastUsedAt ? formatDate(t.lastUsedAt) : '—'}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>
                  {confirmDelete === t.id ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#EF4444' }}>Zeker?</span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={loading}
                        style={{
                          fontSize: 11, color: '#fff', background: '#EF4444',
                          border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                        }}
                      >
                        Ja
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          fontSize: 11, color: '#6B7280', background: '#F1F5F9',
                          border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                        }}
                      >
                        Nee
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(t.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#CBD5E1', padding: 4,
                      }}
                      title="Token intrekken"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Stap 2: Breid de `SettingsTabs` interface uit en voeg `WebhookTokens` toe aan Admin tab**

Open `src/components/settings/settings-tabs.tsx`. Voeg de import toe:

```typescript
import { WebhookTokens } from './webhook-tokens'
```

Breid de interface `SettingsTabsProps` uit:

```typescript
interface WebhookToken {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

interface SettingsTabsProps {
  assistants: Assistant[]
  tenants: Tenant[]
  webhookTokens: WebhookToken[]
}
```

Voeg `webhookTokens` toe aan de destructuring:

```typescript
export function SettingsTabs({ assistants, tenants, webhookTokens }: SettingsTabsProps) {
```

Voeg in het `{active === 'admin' && ...}` blok de `WebhookTokens` component toe na `<AdminAssistants>`:

```typescript
      {active === 'admin' && (
        <div>
          <AdminAssistants assistants={assistants} tenants={tenants} />
          <WebhookTokens initial={webhookTokens} />
        </div>
      )}
```

- [ ] **Stap 3: Breid `settings/page.tsx` uit om webhook tokens te fetchen**

Open `src/app/(dashboard)/settings/page.tsx`. Voeg de import toe:

```typescript
import { webhookTokens } from '@/db/schema/app'
```

Breid `getData()` uit:

```typescript
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function getData() {
  try {
    const [allAssistants, allTenants, allWebhookTokens] = await Promise.all([
      db.select().from(assistants).orderBy(assistants.createdAt),
      db.select().from(tenants).orderBy(tenants.name),
      db.select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      }).from(webhookTokens).where(eq(webhookTokens.tenantId, DEMO_TENANT_ID)),
    ])
    return { allAssistants, allTenants, allWebhookTokens }
  } catch {
    return { allAssistants: [], allTenants: [], allWebhookTokens: [] }
  }
}
```

Voeg `eq` toe aan de drizzle import:

```typescript
import { eq } from 'drizzle-orm'
```

Pas de component aan om de tokens door te sturen:

```typescript
export default async function SettingsPage() {
  const { allAssistants, allTenants, allWebhookTokens } = await getData()

  const assistantsData = allAssistants.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))

  const tenantsData = allTenants.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  const webhookTokensData = allWebhookTokens.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }))

  return (
    // ... bestaande JSX ...
    <SettingsTabs assistants={assistantsData} tenants={tenantsData} webhookTokens={webhookTokensData} />
    // ...
  )
}
```

- [ ] **Stap 4: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 5: Commit**

```bash
git add src/components/settings/webhook-tokens.tsx src/components/settings/settings-tabs.tsx "src/app/(dashboard)/settings/page.tsx"
git commit -m "feat: voeg webhook token beheer UI toe aan Admin tab"
```

---

## Task 9: UI — Edit modal in `admin-assistants.tsx`

**Files:**
- Modify: `src/components/settings/admin-assistants.tsx`

- [ ] **Stap 1: Breid `EditForm` interface uit**

Zoek de `EditForm` interface en vervang het `webhook` veld door twee nieuwe velden:

```typescript
interface EditForm {
  name: string
  description: string
  type: string
  sub: string
  interactie: string
  webhookUrl: string
  webhookToken: string
  webhookTokenEditing: boolean
  chatten: boolean
  bestandenUploaden: boolean
}
```

- [ ] **Stap 2: Pas `emptyForm` aan**

```typescript
const emptyForm: EditForm = {
  name: '',
  description: '',
  type: 'redeneer',
  sub: 'beide',
  interactie: 'web',
  webhookUrl: '',
  webhookToken: '',
  webhookTokenEditing: false,
  chatten: false,
  bestandenUploaden: false,
}
```

- [ ] **Stap 3: Breid `Assistant` interface uit met webhook velden**

```typescript
interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  tenantId: string
  createdAt: string
  updatedAt?: string
  webhookUrl: string | null
  webhookTokenEncrypted: string | null
}
```

- [ ] **Stap 4: Pas de `openEdit` handler aan om webhook velden te laden**

Zoek de handler die `setForm(...)` aanroept bij het openen van de edit modal en voeg de nieuwe velden toe:

```typescript
  const openEdit = (a: Assistant) => {
    setForm({
      name: a.name,
      description: a.description,
      type: a.type,
      sub: 'beide',
      interactie: 'web',
      webhookUrl: a.webhookUrl ?? '',
      webhookToken: '',
      webhookTokenEditing: false,
      chatten: false,
      bestandenUploaden: false,
    })
    setEditingId(a.id)
  }
```

- [ ] **Stap 5: Pas `handleSave` aan om webhook velden mee te sturen**

Zoek in `handleSave` het PATCH-stuk en voeg webhook velden toe aan de body:

```typescript
        const patchBody: Record<string, unknown> = {
          name: form.name,
          description: form.description,
          type: form.type,
        }
        if (form.webhookUrl !== undefined) patchBody.webhookUrl = form.webhookUrl || null
        if (form.webhookTokenEditing && form.webhookToken) {
          patchBody.webhookToken = form.webhookToken
        }

        const res = await fetch(`/api/assistants/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
```

- [ ] **Stap 6: Vervang het bestaande `webhook` formulierveld door de nieuwe velden**

Zoek het bestaande veld met `value={form.webhook}` en vervang het door twee velden:

```tsx
              {/* Webhook URL */}
              <FormField label="Webhook URL (N8N)">
                <input
                  value={form.webhookUrl}
                  onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                  placeholder="https://n8n.jouwdomein.nl/webhook/..."
                  type="url"
                  style={fieldStyle}
                />
              </FormField>

              {/* Webhook token */}
              <FormField label="Webhook token">
                {form.webhookTokenEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus
                      value={form.webhookToken}
                      onChange={(e) => setForm((f) => ({ ...f, webhookToken: e.target.value }))}
                      placeholder="Nieuw token invoeren"
                      type="text"
                      style={{ ...fieldStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, webhookTokenEditing: false, webhookToken: '' }))}
                      style={{
                        height: 32, padding: '0 10px', borderRadius: 6,
                        background: '#F1F5F9', border: '1px solid #CBD5E1',
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
                      }}
                    >
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value="••••••••••••••••"
                      disabled
                      style={{ ...fieldStyle, flex: 1, color: '#9CA3AF' }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, webhookTokenEditing: true }))}
                      style={{
                        height: 32, padding: '0 10px', borderRadius: 6,
                        background: '#F1F5F9', border: '1px solid #CBD5E1',
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
                      }}
                    >
                      Bewerken
                    </button>
                  </div>
                )}
              </FormField>
```

- [ ] **Stap 7: Verifieer TypeScript**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Stap 8: Schrijf E2E test voor webhook UI**

```typescript
// e2e/webhook-tokens.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Admin tab — Webhook tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
  })

  test('toont Webhook tokens sectie in Admin tab', async ({ page }) => {
    await expect(page.getByText('Webhook tokens')).toBeVisible()
    await expect(page.getByText('Bearer tokens voor inkomende N8N webhooks')).toBeVisible()
  })

  test('toont Nieuw token knop', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nieuw token' })).toBeVisible()
  })

  test('klik Nieuw token opent naam-invoerveld', async ({ page }) => {
    await page.getByRole('button', { name: 'Nieuw token' }).click()
    await expect(page.getByPlaceholder("Token naam, bijv. 'N8N productie'")).toBeVisible()
  })
})

test.describe('Admin tab — Edit modal webhook velden', () => {
  test('edit modal toont Webhook URL veld', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()

    // Open edit modal voor eerste assistent
    await page.getByTitle('Bewerken').first().click()

    await expect(page.getByPlaceholder('https://n8n.jouwdomein.nl/webhook/...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bewerken' })).toBeVisible()
  })

  test('Bewerken knop maakt webhook token veld bewerkbaar', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Bewerken').first().click()

    await page.getByRole('button', { name: 'Bewerken' }).click()
    await expect(page.getByPlaceholder('Nieuw token invoeren')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Annuleren' })).toBeVisible()
  })

  test('Annuleren verbergt token invoerveld', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Admin' }).click()
    await page.getByTitle('Bewerken').first().click()

    await page.getByRole('button', { name: 'Bewerken' }).click()
    await page.getByRole('button', { name: 'Annuleren' }).click()
    await expect(page.getByPlaceholder('Nieuw token invoeren')).not.toBeVisible()
  })
})
```

- [ ] **Stap 9: Draai de E2E tests**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx playwright test e2e/webhook-tokens.spec.ts --reporter=list
```

Verwacht: alle tests slagen. Als een test faalt door een DB-fout, controleer dan of de dev server draait en de migratie uitgevoerd is.

- [ ] **Stap 10: Commit**

```bash
git add src/components/settings/admin-assistants.tsx e2e/webhook-tokens.spec.ts
git commit -m "feat: breid edit modal uit met webhook URL en masked token veld"
```

---

## Task 10: Migratie uitvoeren via Coolify

**Stap 1: Bereken SHA-256 hash van het migratiebestand**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && node -e "
const fs = require('fs');
const crypto = require('crypto');
const content = fs.readFileSync('src/db/migrations/0005_webhook_tokens.sql', 'utf8');
console.log(crypto.createHash('sha256').update(content).digest('hex'));
"
```

**Stap 2: Open Coolify → PostgreSQL service → Terminal**

Verbind met psql:

```bash
psql -U postgres
```

**Stap 3: Plak de migratie SQL in psql**

Plak de volledige inhoud van `src/db/migrations/0005_webhook_tokens.sql`.

**Stap 4: Registreer de migratie in Drizzle journal**

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<hash-uit-stap-1>', 1745008800000);
```

**Stap 5: Verifieer**

```sql
\d app.webhook_tokens
\d app.assistants
SELECT id FROM rbac.permissions WHERE id = 'webhooks.manage';
```

Verwacht: tabel aanwezig, kolommen `webhook_url` en `webhook_token_encrypted` zichtbaar op assistants, permissie aanwezig.

**Stap 6: Draai de RBAC seed opnieuw om `webhooks.manage` toe te voegen (optioneel, want al in migratie)**

```bash
cd "c:\Users\jaap\stack\8. Claude Code\6 BOM\BOM" && npx tsx src/db/seed-rbac.ts
```

---

## Zelfreview — Spec coverage check

| Spec-eis | Taak |
|----------|------|
| `app.webhook_tokens` tabel | Task 1 |
| `assistants.webhook_url` + `webhook_token_encrypted` | Task 1 |
| AES-256-GCM encrypt/decrypt in `src/lib/crypto.ts` | Task 2 |
| `ENCRYPTION_KEY` env var | Task 2 |
| `webhooks.manage` RBAC permissie | Task 3 + migratie SQL |
| `POST /api/webhooks/inbound` met Bearer token validatie | Task 4 |
| SHA-256 hash lookup + `last_used_at` update | Task 4 |
| `GET/POST /api/webhooks/tokens` | Task 5 |
| `DELETE /api/webhooks/tokens/[id]` | Task 5 |
| Plaintext token eenmalig teruggeven bij aanmaken | Task 5 |
| `POST /api/assistant-runs` met outbound fire-and-forget | Task 6 |
| Outbound payload: runId, assistantId, assistantName, output, timestamp | Task 6 |
| PATCH assistants accepteert webhookUrl + webhookToken | Task 7 |
| Admin tab: token tabel + aanmaken + intrekken | Task 8 |
| Token eenmalig tonen met kopieerknop | Task 8 |
| Bevestigingsdialog bij intrekken | Task 8 |
| Assistent edit modal: webhook URL veld | Task 9 |
| Assistent edit modal: masked token + Bewerken knop | Task 9 |
| SQL migratie `0005_webhook_tokens.sql` | Task 1 + 10 |

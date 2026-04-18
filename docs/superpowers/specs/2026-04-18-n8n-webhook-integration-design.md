# N8N Webhook Integratie — Design Spec

**Datum:** 2026-04-18  
**Status:** Goedgekeurd, klaar voor implementatie

---

## Doel

BOM koppelen aan N8N via webhooks in twee richtingen:

- **Inbound:** N8N stuurt verwerkte resultaten naar BOM → review item aanmaken
- **Outbound:** BOM stuurt AI-assistent output (tekst/JSON) naar een N8N webhook

Authenticatie in beide richtingen via bearer tokens. Uitgaande tokens worden encrypted opgeslagen (AES-256-GCM).

---

## Architectuur

```
N8N ──(Bearer token)──▶ POST /api/webhooks/inbound ──▶ app.review_items
BOM ──(Bearer token)──▶ POST https://n8n.../webhook ──▶ N8N workflow
```

Tokens voor inbound verkeer worden per tenant beheerd (meerdere per tenant). Tokens voor outbound verkeer worden per assistent opgeslagen, encrypted via `ENCRYPTION_KEY` in `.env`.

---

## Data model

### Nieuw: `app.webhook_tokens`

Inbound tokens — meerdere per tenant, elk met een naam voor herkenning.

```sql
app.webhook_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  token_hash    text NOT NULL UNIQUE,  -- SHA-256 hash van het plaintext token
  created_at    timestamp NOT NULL DEFAULT now(),
  last_used_at  timestamp             -- bijgewerkt bij elk succesvol gebruik
)
```

Het plaintext token wordt eenmalig getoond bij aanmaak en daarna nooit meer opgeslagen.

### Wijziging: `app.assistants`

Twee nieuwe nullable kolommen:

```sql
ALTER TABLE app.assistants
  ADD COLUMN webhook_url             text,         -- N8N webhook URL (outbound)
  ADD COLUMN webhook_token_encrypted text;         -- AES-256-GCM encrypted token
```

---

## API Endpoints

### Inbound — N8N → BOM

```
POST /api/webhooks/inbound
Authorization: Bearer <plaintext-token>
Content-Type: application/json

{
  "assistantId": "uuid",
  "title": "Factuur verwerkt",
  "description": "Optionele details",
  "priority": "medium"              // 'low' | 'medium' | 'high' | 'critical'
}
```

**Verwerking:**
1. Hash het token (SHA-256), zoek op in `app.webhook_tokens`
2. Haal `tenant_id` op uit het token-record
3. Update `last_used_at`
4. Maak review item aan in `app.review_items`
5. Return `{ id: "<uuid>", ok: true }` (201)

**Foutcodes:** 401 (ongeldig token), 400 (validatiefout), 500 (interne fout)

---

### Token beheer

Alle routes vereisen sessie-authenticatie + `canDo(userId, tenantId, 'webhooks', 'manage')`.

```
GET    /api/webhooks/tokens          -- lijst tokens (naam, aanmaakdatum, last_used_at)
POST   /api/webhooks/tokens          -- nieuw token aanmaken
       body: { name: string }
       response: { id, name, token }  ← plaintext eenmalig teruggeven
DELETE /api/webhooks/tokens/[id]     -- token intrekken
```

---

### Outbound — BOM → N8N

Getriggerd via de bestaande `POST /api/assistant-runs` route wanneer `output` aanwezig is én de assistent een `webhook_url` heeft.

BOM POST naar `assistants.webhook_url`:

```
POST <webhook_url>
Authorization: Bearer <decrypted-token>
Content-Type: application/json

{
  "runId": "uuid",
  "assistantId": "uuid",
  "assistantName": "Factuurverwerker",
  "output": "...",               -- plaintext of JSON stringified
  "timestamp": "2026-04-18T..."
}
```

Fire-and-forget: fouten worden gelogd maar blokkeren de run niet.

---

## Encryptie

**Locatie:** `src/lib/crypto.ts`

AES-256-GCM via Node.js `crypto` module. Geen externe dependency.

```typescript
// Vereiste env-variabele:
ENCRYPTION_KEY=<64 hex chars — 32 bytes>

export function encrypt(plaintext: string): string  // → "iv:tag:ciphertext" (hex)
export function decrypt(encrypted: string): string  // → plaintext
```

Genereer een sleutel met:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## RBAC

Nieuwe permissie toevoegen aan het bestaande RBAC-systeem:

| Permission ID       | Resource  | Action | admin | member |
|---------------------|-----------|--------|:-----:|:------:|
| `webhooks.manage`   | webhooks  | manage | ✓     |        |

Seed-script uitbreiden met deze permissie.

---

## UI — Settings pagina

### Tab "Admin" — Token beheer

Nieuwe sectie onder de bestaande admin-content:

- Tabel: naam | aanmaakdatum | laatste gebruik | [intrekken]
- "Nieuw token aanmaken" knop → modal met naamveld → token eenmalig tonen met kopieerknop
- Bevestigingsdialog bij intrekken

### Tab "Assistenten beheer" — Edit modal

Twee nieuwe velden onderaan het bestaande formulier:

```
Webhook URL (N8N)
[ https://n8n.domein.nl/webhook/...          ]

Webhook token
[ ••••••••••••••••  ] [Bewerken]
```

Token-veld toont masked waarde als ingesteld; "Bewerken" maakt het bewerkbaar.

---

## Migratie

Één SQL-migratie (`0005_webhook_tokens.sql`):

```sql
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

-- RBAC: nieuwe permissie
INSERT INTO rbac.permissions (id, resource, action, description)
VALUES ('webhooks.manage', 'webhooks', 'manage', 'Webhook tokens beheren');

INSERT INTO rbac.role_permissions (role_id, permission_id)
VALUES ('admin', 'webhooks.manage');
```

---

## Bestandsstructuur na implementatie

```
src/
  app/api/
    webhooks/
      inbound/route.ts         ← POST inbound van N8N
      tokens/route.ts          ← GET + POST tokens
      tokens/[id]/route.ts     ← DELETE token
  lib/
    crypto.ts                  ← encrypt() + decrypt()
  db/
    schema/app.ts              ← webhookTokens tabel toegevoegd
    migrations/
      0005_webhook_tokens.sql
```

---

## Niet in scope

- Webhook retries bij N8N-fouten (fire-and-forget volstaat)
- Webhook logs / delivery history
- Token expiry / rotatie
- Meerdere webhook URLs per assistent

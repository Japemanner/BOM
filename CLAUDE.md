# BOM — BackOffice AI Platform
This project follows the rules defined in .claude/rules/. Always reference these files before suggesting architectural changes

## Projectoverzicht

BOM is een multi-tenant SaaS-platform waarmee organisaties AI-assistenten beheren, configureren en monitoren. Tenants kunnen meerdere assistenten inzetten voor taken als factuurverwerking, e-mailclassificatie, ERP-sync en documentcontrole.

## Stack

| Laag | Technologie |
|------|-------------|
| Framework | Next.js 15 App Router (TypeScript) |
| Database | PostgreSQL 18 (pgvector) via Coolify |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth (email/password + magic link) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (client-side persist) |
| Testing | Playwright (E2E) |

## Domeinen & database schemas

```
auth.*   — Better Auth: users, sessions, accounts, verifications
iam.*    — Tenancy: tenants, tenant_members (rol per tenant)
rbac.*   — Permissies: roles, permissions, role_permissions
app.*    — Domein: assistants, assistant_runs, assistant_events, review_items, integrations
```

## RBAC

Twee rollen: `admin` (16 permissies, inclusief `webhooks.manage`) en `member` (3 permissies: read op assistants/integrations/tenant).
Permissiecheck via `canDo(userId, tenantId, resource, action)` in `src/lib/permissions.ts`.

## Bestandsstructuur

```
src/
  app/
    (auth)/          — login, register pagina's
    (dashboard)/     — beschermde app-pagina's
    api/
      assistants/    — CRUD assistenten (incl. webhook URL/token update)
      assistant-runs/ — run aanmaken + outbound webhook trigger
      events/        — assistant events
      review/        — review items (+ prioriteit-sortering)
      dashboard/     — metrics
      webhooks/
        inbound/     — POST inbound van N8N (bearer token auth)
        tokens/      — GET + POST webhook tokens
        tokens/[id]/ — DELETE webhook token
  components/        — UI-componenten (dashboard, settings, integrations, ui)
    settings/
      webhook-tokens.tsx — token beheer UI (aanmaken, kopiëren, intrekken)
  db/
    schema/
      auth.ts        — auth.* tabellen
      iam.ts         — iam.* tabellen
      rbac.ts        — rbac.* tabellen
      app.ts         — app.* tabellen (incl. webhookTokens, assistants.webhookUrl/webhookTokenEncrypted)
      index.ts       — barrel export
    migrations/      — SQL-migratiebestanden (0000–0005)
    seed-rbac.ts     — idempotente RBAC seed
    index.ts         — Drizzle client
  lib/
    auth.ts          — Better Auth configuratie
    permissions.ts   — canDo() helper
    crypto.ts        — AES-256-GCM encrypt() / decrypt() voor webhook tokens
  types/
    index.ts         — gedeelde TypeScript types (UserRole, PermissionResource, incl. webhooks)
```

## Architectuur

Zie `.claude/rules/architecture_rules.md` voor de leidende architectuurprincipes (Theory of Constraints + ontkoppeling).

## Deployment

Push naar `main` gebeurt aan het einde van elke afgeronde taak. Deze push triggert
automatisch een deploy van de applicatie.

```bash
# Workflow aan het einde van elke afgeronde taak:
npm run typecheck   # TypeScript controle
npm run lint        # ESLint controle
git push origin main # Deploy trigger
```

- Code in Engels, comments/uitleg in Nederlands
- Geen onnodige dependencies
- `.env.local` voor secrets, nooit hardcoded — `ENCRYPTION_KEY` (64 hex chars) vereist voor AES-256 webhook token encryptie
- GDPR/AVG by default — geen Amerikaanse providers zonder expliciete goedkeuring
- Schrijfoperaties in API routes beschermen met `canDo()` voor elke nieuwe route

## Migraties uitvoeren

```bash
# database moet bereikbaar zijn
npm run db:migrate

# RBAC seed (idempotent)
npx tsx src/db/seed-rbac.ts
```

## Auth bypass voor E2E tests

Middleware leest `SKIP_AUTH_REDIRECT=true` (ingesteld in `playwright.config.ts`) om auth-redirects over te slaan tijdens CI.

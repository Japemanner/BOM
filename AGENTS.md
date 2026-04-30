# BOM — BackOffice AI Platform

Primaire projectconfiguratie voor opencode. Dit bestand bevat alle regels, conventies en
werk instructies die opencode nodig heeft. Gedetailleerde architectuurregels staan in
`.claude/rules/` — raadpleeg die bij architectuurwijzigingen.

## Projectoverzicht

BOM is een multi-tenant SaaS-platform waarmee organisaties AI-assistenten beheren,
configureren en monitoren. Tenants kunnen meerdere assistenten inzetten voor taken als
factuurverwerking, e-mailclassificatie, ERP-sync en documentcontrole.

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

## Scripts

```bash
npm run dev             # Next.js dev server (turbopack)
npm run build           # Production build
npm run lint            # ESLint
npm run typecheck       # TypeScript type checking (tsc --noEmit)
npm run db:generate     # Drizzle schema → SQL migratie genereren
npm run db:migrate      # Migraties uitvoeren (database moet bereikbaar zijn)
npm run db:studio       # Drizzle Studio (DB browser)
npm run test:e2e        # Playwright E2E tests
npm run test:e2e:ui     # Playwright UI mode
npm run test:e2e:report # Playwright test rapport
```

**Belangrijk:** Draai altijd `npm run typecheck` en `npm run lint` na codewijzigingen.

## Deployment

Push naar `main` gebeurt aan het einde van elke afgeronde taak. Deze push triggert
automatisch een deploy van de applicatie.

```bash
# Workflow aan het einde van elke afgeronde taak:
npm run typecheck   # TypeScript controle
npm run lint        # ESLint controle
git push origin main # Deploy trigger
```

## Domeinen & Database Schemas

```
auth.*   — Better Auth: users, sessions, accounts, verifications
iam.*    — Tenancy: tenants, tenant_members (rol per tenant)
rbac.*   — Permissies: roles, permissions, role_permissions
app.*    — Domein: assistants, assistant_runs, assistant_events, review_items, integrations
```

### Schema-grenzen (strict)

```
auth.*   →  alleen gelezen door Better Auth en src/lib/auth.ts
iam.*    →  toegangspunt voor tenant/member logica
rbac.*   →  alleen gelezen via canDo() — nooit direct in routes
app.*    →  business logica, altijd gefilterd op tenant_id
```

Directe queries op `rbac.*` buiten `src/lib/permissions.ts` zijn **niet toegestaan**.

## RBAC

Twee rollen: `admin` (16 permissies, inclusief `webhooks.manage`) en `member`
(3 permissies: read op assistants/integrations/tenant).
Permissiecheck via `canDo(userId, tenantId, resource, action)` in `src/lib/permissions.ts`.

## Ontwikkelregels

- Code in Engels, comments/uitleg in Nederlands
- Geen onnodige dependencies
- `.env.local` voor secrets, nooit hardcoded — `ENCRYPTION_KEY` (64 hex chars) vereist
  voor AES-256 webhook token encryptie
- GDPR/AVG by default — geen Amerikaanse providers zonder expliciete goedkeuring
- Schrijfoperaties in API routes beschermen met `canDo()` voor elke nieuwe route
- Geen hardcoded tenant IDs — altijd uit sessie of request context halen
- Permissiecheck vóór elke schrijfoperatie in API routes: `if (!await canDo(...)) return 403`

## Codeconventies

### TypeScript

- Gebruik `const X = {...} as const; type X = ...` patroon voor enum-achtige waarden
- Geen `any` — gebruik `unknown` + type narrowing
- Drizzle schema types: gebruik `$inferSelect` / `$inferInsert` voor afgeleide types
- `async/await` over `.then()` chains
- Geen `$type<>` casting als het type al uit het schema infereerbaar is

### Next.js App Router

- Server Components by default; `'use client'` alleen als echt nodig
- API routes: altijd `NextResponse.json()` met expliciete HTTP-statuscodes
- Middleware: alleen cookie-checks, geen database-calls (O(1) latency)

### Naamgeving

- Bestanden: `kebab-case.ts`
- Componenten: `PascalCase.tsx`
- DB-kolommen: `snake_case` in SQL, `camelCase` in Drizzle
- API-routes: REST-achtig (`/api/assistants`, `/api/assistants/[id]`)

### Imports

- Gebruik `@/` aliassen (`@/db`, `@/lib`, `@/types`, `@/components`)
- Importeer altijd uit het meest specifieke subpad: `@/db/schema/app` niet `@/db/schema`

## API Conventies

- Input validatie via Zod op elke route
- Output altijd getypeerd
- Routes mogen niet direct andere routes aanroepen — gebruik gedeelde db-queries of lib-functies
- Breaking changes vereisen versienummer (`/api/v2/...`) of migratie van consumers
- Geen logging van persoonlijke data (email, naam) in plaintext

## Architectuur — Theory of Constraints

Identificeer en elimineer de bottleneck in de dataflow voordat je nieuwe features toevoegt.

Kritieke beperkingen:
1. **Database roundtrips** — gebruik joins in plaats van N+1 queries
2. **Auth middleware** — houd O(1), geen DB-call
3. **Tenant isolation** — elke query op app.* of iam.* MOET gefilterd zijn op `tenant_id`

ToC-checklist voor nieuwe features:
- [ ] Voegt deze feature een nieuwe DB-roundtrip toe per request? Zo ja — kan het met een join?
- [ ] Raakt deze feature de auth/middleware flow? Zo ja — blijft de latency onder 5ms?
- [ ] Leest/schrijft deze feature data voor meerdere tenants? Zo nee — `tenant_id` filter aanwezig?

`app.assistant_events` heeft geen FK naar assistants — events zijn immutable audit logs,
append-only.

## Review Checklist

Bij elke review van gewijzigde code, controleer:

1. **Tenant isolation** — elke `app.*` query heeft een `tenant_id` filter
2. **Permissiechecks** — schrijfoperaties in API routes roepen `canDo()` aan
3. **Schema-grenzen** — geen directe `rbac.*` queries buiten `src/lib/permissions.ts`
4. **TypeScript** — geen `any`, geen onnodige type assertions
5. **GDPR** — geen logging van persoonlijke data (email, naam) in plaintext
6. **ToC** — geen nieuwe N+1 queries, middleware blijft O(1)

Review workflow:
1. `git diff main...HEAD` — bekijk alle gewijzigde bestanden
2. Controleer op architectuurregels (zie `.claude/rules/architecture_rules.md`)
3. Controleer op codestijl (zie `.claude/rules/code-style.md`)
4. Rapporteer: APPROVED / NEEDS FIXES met specifieke bevindingen per bestand

## Coding Principes (Karpathy Guidelines)

1. **Think Before Coding** — State assumptions explicitly. If uncertain, ask.
   Multiple interpretations? Present them. Simpler approach? Say so.
2. **Simplicity First** — Minimum code that solves the problem. No speculative features,
   no abstractions for single-use code. If 200 lines could be 50, rewrite.
3. **Surgical Changes** — Touch only what you must. Match existing style.
   Remove only imports/variables that YOUR changes made unused.
4. **Goal-Driven Execution** — Define success criteria. Loop until verified.
   "Fix bug" → write test that reproduces it → make it pass.

## Playwright E2E Testregels

- Tests staan in `e2e/` — per pagina een eigen spec-bestand
- Auth bypass via `SKIP_AUTH_REDIRECT=true` (geconfigureerd in `playwright.config.ts`)
- Gebruik `getByText()` voor shadcn `CardTitle` (rendert als `<div>`, niet als heading)
- Gebruik `locator('xpath=../..')` voor DOM-traversal omhoog — geen CSS `..`
- Formuliervelden zonder `htmlFor`: gebruik `input[type="password"]` of `input[placeholder="..."]`
- Test gedrag, niet implementatie
- Geen tests die afhankelijk zijn van demo/seed-data die verwijderd kan worden
- Bij modal-tests: sluit altijd af met een sluit-verificatie

## Auth Bypass voor E2E Tests

Middleware leest `SKIP_AUTH_REDIRECT=true` (ingesteld in `playwright.config.ts`) om
auth-redirects over te slaan tijdens CI.

## Migraties

```bash
npm run db:migrate          # database moet bereikbaar zijn
npx tsx src/db/seed-rbac.ts # RBAC seed (idempotent)
```

## Quality Gate

Volg `/quality/bom/criteria.md` bij het afronden van elke taak.

Evaluatieformat:
- Output: {korte beschrijving}
- Criteria checked: {criterium}: PASS / FAIL / PARTIAL — {observatie}
- Score: {X}/{total}
- Gaps: {wat beter kan}
- Verdict: SHIP / REVISE / REJECT

Niet zelf goedkeuren zonder deze check. Score onder threshold → revise before presenting.

## Knowledge & Decisions

- Knowledge base: `/knowledge/INDEX.md` — per domein feiten, hypotheses, bevestigde regels
- Decision journal: `/decisions/YYYY-MM-DD-{topic}.md` — architectuur- en ontwerpbeslissingen
- Raadpleeg altijd bestaande decisions voordat je een beslissing neemt die verder gaat dan vandaag
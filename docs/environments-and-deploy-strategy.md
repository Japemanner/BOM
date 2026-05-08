# BOM — Environments & Deploy Strategy

> Hoe DEV (lokaal), STAGING en PRODUCTIE samenwerken met test-pipelines en branch-strategie.
>
> **Aanvulling op:** [`production-readiness-stappenplan.md`](./production-readiness-stappenplan.md) en [`security-test-playbook.md`](./security-test-playbook.md).
>
> **Stack:** Next.js 15 + Coolify + PostgreSQL 18 + Drizzle. Self-hosted op eigen VPS (GDPR-compliant).

---

## Filosofie — drie omgevingen, drie doelen

```
┌──────────────┬─────────────────────┬─────────────────────────────┐
│ Omgeving     │ Doel                │ Wie                          │
├──────────────┼─────────────────────┼─────────────────────────────┤
│ LOKAAL       │ Snel itereren       │ Jaap + OpenCode              │
│ (dev)        │ Unit + integration  │ Geen externe gebruikers      │
│              │ Hot reload          │ Test-data, gefaked           │
├──────────────┼─────────────────────┼─────────────────────────────┤
│ STAGING      │ Bewijzen dat het    │ Jaap voor pre-release tests  │
│ (test/preview)│ werkt zoals prod   │ Mogelijk klant-demo's        │
│              │ Volledige E2E       │ Geanonimiseerde data         │
│              │ Echte deploy chain  │                              │
├──────────────┼─────────────────────┼─────────────────────────────┤
│ PRODUCTIE    │ Echte gebruikers    │ Echte tenants                │
│              │ Smoke tests only    │ Echte data — GDPR scope      │
│              │ Monitor + alert     │ Backups + DR plan            │
└──────────────┴─────────────────────┴─────────────────────────────┘
```

**Vuistregels:**

1. **Geen productiedata in dev/staging** — ooit. AVG-overtreding én onnodig risico.
2. **Migraties testen op staging vóór prod** — geen uitzonderingen.
3. **Identieke stack** in staging en productie — alleen credentials en domain verschillen.
4. **Snelle feedback dichtbij** — unit tests in seconden lokaal, E2E in minuten op staging.

---

## Branch-strategie

Twee opties — kies er één en hou je eraan:

### Optie A: GitHub Flow (aanbevolen voor solo / klein team)

```
feature/x ──► PR ──► develop ──► (auto-deploy staging) ──► PR ──► main ──► (auto-deploy prod)
```

- Werk op feature-branches: `feat/webhooks-rotation`, `fix/tenant-leak`
- PR naar `develop`: triggert deploy naar staging, draait E2E
- Test op staging
- PR `develop → main`: triggert deploy naar prod, draait alleen smoke tests

**Voordeel:** simpel, één promotion-stap, snel

### Optie B: Trunk-based met preview-deploys

```
feature/x ──► PR (preview deploy) ──► main ──► (auto-deploy prod)
```

- Geen `develop` branch
- Elke PR krijgt eigen preview-URL via Coolify
- Merge naar main = direct prod (achter feature flags)

**Voordeel:** moderner, minder branches. **Nadeel:** vereist feature flags voor risicovolle changes.

**Mijn advies voor BOM:** **Optie A** — je hebt nog niet de scale die feature flags rechtvaardigt, en je hebt al `repository_dispatch` werken op main.

---

## Coolify setup — drie deployments

In Coolify maak je twee aparte applicaties (lokaal is je laptop, geen Coolify nodig):

### Staging deployment

- **Naam:** `bom-staging`
- **Source:** GitHub repo, branch `develop`
- **Domain:** `staging.bom.jouwdomein.nl`
- **Environment variables:** zie sectie hieronder
- **Database:** aparte Postgres-instance `bom_staging` (zie database sectie)
- **Auto-deploy:** ja, op elke push naar `develop`
- **Health check:** `/api/health` (uit fase 6 stappenplan)
- **Resource limits:** 1 vCPU, 1 GB RAM is zat

### Productie deployment

- **Naam:** `bom-production`
- **Source:** GitHub repo, branch `main`
- **Domain:** `bom.jouwdomein.nl` (of klant-specifiek)
- **Environment variables:** apart, met productie-secrets
- **Database:** aparte Postgres-instance `bom_production`
- **Auto-deploy:** ja, op elke push naar `main`
- **Health check:** `/api/health`
- **Resource limits:** schaalt mee met load
- **Backup:** dagelijks (Coolify built-in of pg_dump cron)

### Lokaal (dev)

- `docker-compose.yml` (al aanwezig)
- `.env.local` met `bom_dev` database
- Hot reload via `npm run dev`

---

## Database strategie

**Drie aparte databases**, identiek schema, verschillende data:

| Omgeving  | Hostname              | Database     | Migraties               | Seed data       |
|-----------|-----------------------|--------------|-------------------------|-----------------|
| Lokaal    | `localhost:5432`      | `bom_dev`    | `npm run db:migrate`    | Eigen test-seed |
| Staging   | Coolify Postgres      | `bom_staging`| Auto via deploy hook    | Geanonimiseerd  |
| Productie | Coolify Postgres (apart) | `bom_production` | Handmatig of in deploy  | Geen seed       |

### Migraties per omgeving

Update `package.json`:

```json
{
  "scripts": {
    "db:migrate": "drizzle-kit migrate",
    "db:migrate:staging": "DATABASE_URL=$STAGING_DATABASE_URL drizzle-kit migrate",
    "db:migrate:prod": "DATABASE_URL=$PROD_DATABASE_URL drizzle-kit migrate"
  }
}
```

**Migratie workflow per omgeving:**

```
Lokaal:    npm run db:generate → npm run db:migrate → test
                                                       ↓
Staging:   git push develop → Coolify deploy → migrate hook draait → E2E
                                                                      ↓
Productie: git push main → handmatig: npm run db:migrate:prod → deploy
```

**Belangrijk:** **migreer eerst, deploy daarna** in productie. Backwards-compatible migraties zijn de norm:

- ✅ Kolom toevoegen met default
- ✅ Index toevoegen
- ✅ Tabel toevoegen
- ⚠️ Kolom hernoemen → twee-staps: nieuwe kolom + dual-write code → migrate data → drop oude kolom in volgende release
- ❌ Kolom droppen zonder voorafgaande release zonder die kolom

### Drizzle migratie-hook in Coolify

In Coolify staging deployment, "Pre-deployment commands":

```bash
npm run db:migrate
```

Voor productie: **niet automatisch**. Doe het handmatig vanaf je laptop met `DATABASE_URL=$PROD_URL npx drizzle-kit migrate`. Reden: een corrupte migratie op prod is moeilijk terug te draaien — je wil de gelegenheid hebben om eerst staging te checken.

---

## Secrets management — drie sets

**Nooit dezelfde secrets in twee omgevingen.** Dit is non-negotiable.

### `.env.example` aanpassen

Vermeld expliciet voor welke omgeving elke variabele bedoeld is:

```bash
# === Database ===
# Lokaal: postgresql://postgres:postgres@localhost:5432/bom_dev
# Staging/Prod: ingesteld in Coolify
DATABASE_URL=postgresql://user:pass@host:5432/bom_dev

# === Auth ===
# Per omgeving uniek! Genereer met:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000  # → https://staging.bom... → https://bom...

# === Encryption ===
# Per omgeving uniek! 32-byte AES-256 key (64 hex chars)
# Wijzig nooit op productie zonder webhook tokens te re-encrypten!
ENCRYPTION_KEY=

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000  # → staging URL → prod URL

# === S3 (Hetzner EU) ===
# Aparte buckets per omgeving: bom-dev / bom-staging / bom-production
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=eu-central-1

# === Observability (alleen staging/prod) ===
GLITCHTIP_DSN=
GLITCHTIP_AUTH_TOKEN=

# === Environment marker ===
# 'development' | 'staging' | 'production'
NEXT_PUBLIC_ENV=development
```

### Coolify environment variables instellen

Per deployment apart invullen — kopieer **niet** van staging naar prod.

**Test of secrets uniek zijn:**

```bash
# Lokaal — vergelijk hashes
echo -n "$LOCAL_ENCRYPTION_KEY" | sha256sum
echo -n "$STAGING_ENCRYPTION_KEY" | sha256sum
echo -n "$PROD_ENCRYPTION_KEY" | sha256sum
# Drie verschillende hashes — anders herstellen
```

### `NEXT_PUBLIC_ENV` zichtbaarheid

Gebruik dit voor een visuele banner zodat je nooit per ongeluk in productie test:

```typescript
// src/components/env-banner.tsx
export function EnvBanner() {
  const env = process.env.NEXT_PUBLIC_ENV;
  if (env === 'production' || !env) return null;
  return (
    <div className={`fixed top-0 right-0 px-3 py-1 text-xs text-white z-50
      ${env === 'staging' ? 'bg-orange-600' : 'bg-blue-600'}`}>
      {env.toUpperCase()}
    </div>
  );
}
```

---

## Test-pipeline per omgeving

Welke tests draaien waar, en wanneer:

```
┌─────────────────────────────────────────────────────────────────┐
│ LOKAAL (op je laptop)                                            │
│ ─ Pre-commit: lint + format                                      │
│ ─ Pre-push: typecheck + unit tests                               │
│ ─ Handmatig: npm run test:e2e (tegen lokale dev server)          │
└─────────────────────────────────────────────────────────────────┘
                            │ git push feature/x
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CI op PR → develop                                               │
│ ─ Lint (verplicht groen)                                         │
│ ─ TypeScript (verplicht)                                         │
│ ─ Unit tests + coverage thresholds (verplicht)                   │
│ ─ Integration tests met test-Postgres service (verplicht)        │
│ ─ Build check (verplicht)                                        │
│ ─ Security: Gitleaks, npm audit, Semgrep, CodeQL, Trivy         │
└─────────────────────────────────────────────────────────────────┘
                            │ merge naar develop
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STAGING DEPLOY (auto via Coolify)                                │
│ ─ Coolify: build + db:migrate + deploy                           │
│ ─ GitHub Action wacht op repository_dispatch                     │
│ ─ Volledige E2E suite tegen staging URL                          │
│ ─ Security E2E (auth, tenant isolation, headers)                 │
│ ─ OWASP ZAP baseline scan (wekelijks gepland)                    │
│ ─ Bij falen: rollback automatisch + notify                       │
└─────────────────────────────────────────────────────────────────┘
                            │ PR develop → main
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CI op PR → main                                                  │
│ ─ Alle bovenstaande checks opnieuw (snel, gecached)              │
│ ─ Branch up-to-date check                                        │
│ ─ Vereist 1 approval (jij na 24u, of teamlid)                    │
└─────────────────────────────────────────────────────────────────┘
                            │ merge naar main
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ PRODUCTION DEPLOY                                                │
│ ─ Migraties: handmatig vanaf laptop (vóór deploy)                │
│ ─ Coolify: build + deploy met blue-green of rolling              │
│ ─ Smoke tests tegen prod (alleen kritieke flows: auth, dashboard)│
│ ─ GlitchTip + Uptime Kuma watchen                                │
│ ─ Bij falen binnen 5 min: rollback naar vorige image             │
└─────────────────────────────────────────────────────────────────┘
```

### Concrete CI workflow updates

#### `.github/workflows/checks.yml` — alle PR's

Bestaande workflow uit fase 3 stappenplan, ongewijzigd. Draait op zowel `develop` als `main` PR's.

#### `.github/workflows/playwright.yml` — aanpassen voor staging E2E

Vervang de huidige `playwright.yml` zo dat:

```yaml
name: Playwright E2E
on:
  repository_dispatch:
    types: [coolify-deploy-success]
  pull_request:
    branches: [develop, main]
  workflow_dispatch:
    inputs:
      target:
        type: choice
        options: [local, staging, production]
        default: local

jobs:
  e2e-local:
    name: E2E — Lokaal (CI dev server)
    if: github.event.inputs.target != 'staging' && github.event.inputs.target != 'production'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18-alpine
        # ... bestaande config
    # Draait volledige suite tegen lokale dev server in CI

  e2e-staging:
    name: E2E — Staging (na deploy)
    if: |
      (github.event_name == 'repository_dispatch' && github.event.client_payload.environment == 'staging')
      || github.event.inputs.target == 'staging'
    runs-on: ubuntu-latest
    environment: staging  # GitHub Environment voor approval gates
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Volledige E2E suite tegen staging
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
          PLAYWRIGHT_TEST_USER_EMAIL: ${{ secrets.STAGING_TEST_USER_EMAIL }}
          PLAYWRIGHT_TEST_USER_PASSWORD: ${{ secrets.STAGING_TEST_USER_PASSWORD }}
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-staging-${{ github.run_id }}
          path: playwright-report/

  smoke-production:
    name: Smoke — Productie (na deploy)
    if: |
      (github.event_name == 'repository_dispatch' && github.event.client_payload.environment == 'production')
      || github.event.inputs.target == 'production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Smoke tests tegen productie
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.PRODUCTION_URL }}
        # Alleen kritieke flows — geen tests die data wijzigen
        run: npx playwright test --grep "@smoke"
```

### Smoke tests markeren

Voeg `@smoke` tag toe aan tests die veilig tegen productie kunnen:

```typescript
test('@smoke homepage laadt en heeft login-link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
});

test('@smoke /api/health geeft 200', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe('ok');
});
```

**Regel:** smoke tests **lezen alleen**. Nooit POST/PATCH/DELETE tegen productie.

---

## Coolify → GitHub deploy notifications

Coolify kan een webhook sturen na succesvolle deploy. Configureer per omgeving:

### Staging webhook

In Coolify staging deployment → "Notifications" → Webhook:

```
URL: https://api.github.com/repos/<owner>/<repo>/dispatches
Method: POST
Headers:
  Authorization: token <GITHUB_PAT_with_repo_scope>
  Accept: application/vnd.github.v3+json
Body:
{
  "event_type": "coolify-deploy-success",
  "client_payload": {
    "environment": "staging",
    "commit": "{{ git_commit }}"
  }
}
```

### Productie webhook

Identiek maar met `"environment": "production"`.

---

## Test-data strategie

### Lokaal: gefakte test-data

- Eigen seed-script in `src/db/seed-dev.ts`
- 2 tenants, 5 users per tenant, 10 assistants
- Geen echte emails — `test-{uuid}@example.com`
- Run met `npx tsx src/db/seed-dev.ts`

### Staging: geanonimiseerde productie-data

**Optie 1 — eenvoudig:** Eigen anonimisatie-script dat productie pg_dump pakt en alle PII anonimiseert:

```bash
# scripts/anonymize-prod-to-staging.sh
#!/bin/bash
set -e

# Stap 1: dump productie naar tijdelijk bestand
pg_dump $PROD_DATABASE_URL --no-owner --no-acl > /tmp/prod-dump.sql

# Stap 2: restore in lokale temp-DB
createdb bom_anonymize
psql bom_anonymize < /tmp/prod-dump.sql

# Stap 3: anonimiseer
psql bom_anonymize <<'SQL'
UPDATE auth.users SET
  email = 'user-' || id || '@example.com',
  name = 'Test User ' || id;
UPDATE app.assistant_events SET
  payload = '{}'::jsonb;
DELETE FROM auth.sessions;
-- Webhook tokens regenereren (encrypted, dus na re-encrypt met staging key)
DELETE FROM app.webhook_tokens;
SQL

# Stap 4: dump anoniem en restore op staging
pg_dump bom_anonymize > /tmp/staging-import.sql
psql $STAGING_DATABASE_URL < /tmp/staging-import.sql

# Stap 5: cleanup
dropdb bom_anonymize
rm /tmp/prod-dump.sql /tmp/staging-import.sql
```

**Optie 2 — volledig:** [`pg_anonymizer`](https://postgresql-anonymizer.readthedocs.io/) extensie. Krachtiger maar meer setup.

**Frequentie:** wekelijks of bij behoefte. Niet automatisch — mens-in-de-loop voor AVG-check.

### Productie: geen test-data

Productie krijgt nooit fixture-data. Eerste echte tenant is je eerste echte data.

---

## Promotion flow — concreet stappenplan

Bij een nieuwe feature:

1. **Lokaal:** branch maken
   ```bash
   git checkout develop && git pull
   git checkout -b feat/webhooks-rotation
   # ... code + tests
   npm run typecheck && npm test
   ```

2. **PR naar `develop`:** CI draait, jij reviewt
   ```bash
   git push -u origin feat/webhooks-rotation
   gh pr create --base develop --title "feat: webhook rotation"
   ```

3. **Merge develop:** Coolify deployt staging, GH Action draait E2E
   - Wacht op groene staging E2E vóór je verder gaat
   - Test handmatig op staging waar nodig

4. **PR `develop → main`:** opnieuw CI + 1 approval
   ```bash
   gh pr create --base main --head develop --title "release: <korte samenvatting>"
   ```

5. **Vóór merge naar main: migraties op prod**
   ```bash
   # Vanaf je laptop
   DATABASE_URL=$PROD_DATABASE_URL npx drizzle-kit migrate
   # Verifieer met: psql $PROD_DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
   ```

6. **Merge naar main:** Coolify deployt productie
   - Smoke tests draaien automatisch
   - Watch GlitchTip + Uptime Kuma de eerste 15 min

7. **Bij issues op productie:** rollback
   ```bash
   # Coolify UI: "Rollback to previous deployment"
   # Of revert de merge:
   git revert -m 1 HEAD && git push origin main
   ```

---

## Migratie-rollback strategie

Coolify rollback rolt code terug, **niet** database-wijzigingen. Dus:

1. **Backwards-compatible migraties zijn de norm** — code v2 werkt met DB v1 én DB v2
2. **Voor risicovolle migraties:** schrijf rollback-SQL in een `down.sql` naast de Drizzle-migratie
3. **Backup vóór destructieve migraties:**
   ```bash
   pg_dump $PROD_DATABASE_URL > backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql
   ```

**Voorbeeld two-phase column rename:**

```
Release 1: voeg nieuwe kolom toe, dual-write in code
Release 2: backfill bestaande rijen
Release 3: read-from-new-only
Release 4: drop oude kolom
```

Tijdrovend maar reversible op elk punt.

---

## CI environment-protections

GitHub Environments geven approval gates voor productie deploys.

- [ ] **Settings → Environments → New environment: `staging`**
  - Auto-approval (geen gates)
  - Secrets: `STAGING_URL`, `STAGING_DATABASE_URL`, `STAGING_TEST_USER_*`

- [ ] **Settings → Environments → New environment: `production`**
  - Required reviewers: jij (zelfs solo: dwingt bewuste klik)
  - Wait timer: 5 minuten (geeft je tijd om E2E te checken)
  - Secrets: `PRODUCTION_URL`, `PRODUCTION_DATABASE_URL` (read-only test user)

**Waarom:** voorkomt dat een ge-merged PR direct alle productie-tests trapt zonder bewuste actie. Vooral nuttig na incident-recovery.

---

## Monitoring per omgeving

| Omgeving | Error tracking | Uptime | Logs        | Alerts naar  |
|----------|----------------|--------|-------------|--------------|
| Lokaal   | Console + DevTools | n.v.t. | Console | n.v.t.       |
| Staging  | GlitchTip (project: `bom-staging`) | Uptime Kuma | Coolify logs | Email |
| Productie| GlitchTip (project: `bom-production`) | Uptime Kuma | Coolify + extern | Email + Telegram |

**Belangrijk:** **gescheiden GlitchTip-projecten** voor staging en prod, anders kun je geen onderscheid maken in events.

---

## Checklist — eerste keer opzetten

Eenmalige setup van staging + productie scheiding (~3 uur):

- [ ] In Coolify: tweede applicatie `bom-staging` gemaakt op `develop` branch
- [ ] In Coolify: aparte Postgres-instance voor staging
- [ ] DNS: `staging.bom.jouwdomein.nl` wijst naar Coolify
- [ ] SSL/TLS via Coolify automatisch (Let's Encrypt)
- [ ] Aparte secrets in Coolify: `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, S3 credentials
- [ ] Coolify webhook → GitHub `repository_dispatch` met environment payload
- [ ] GitHub Environments `staging` en `production` aangemaakt
- [ ] `playwright.yml` workflow aangepast voor staging/production targets
- [ ] `@smoke` tag toegevoegd aan kritieke tests
- [ ] EnvBanner component zichtbaar in dev/staging
- [ ] `NEXT_PUBLIC_ENV` ingesteld per omgeving
- [ ] Anonimisatie-script werkt en is 1x getest
- [ ] Migratie-workflow gedocumenteerd in README
- [ ] Rollback 1x getest (deploy → rollback → verify)
- [ ] Branch protection op zowel `main` als `develop`

---

## Kosten

Met self-hosting op Coolify (Hetzner VPS):

| Resource | Kosten | Notitie |
|----------|--------|---------|
| Hetzner VPS (CX22, 2 vCPU, 8 GB) | ~€7/maand | Genoeg voor staging + prod |
| Tweede VPS voor isolatie (optioneel) | +€7/maand | Aanbevolen voor "echte" productie |
| Domain + SSL | €0 | Let's Encrypt via Coolify |
| GlitchTip self-hosted | €0 | Draait op zelfde VPS |
| Uptime Kuma self-hosted | €0 | Draait op zelfde VPS |
| GitHub Actions | €0 | Binnen 2000 min/maand free tier |
| **Totaal** | **~€7-14/maand** | Inclusief alle tooling |

Vergelijking: Vercel + Sentry + Datadog voor zelfde setup = **~€100-200/maand**.

---

## Wanneer dit aanpassen

- **Meer dan 1 ontwikkelaar erbij:** voeg per-PR preview deployments toe (Optie B branch-strategie)
- **Echte enterprise klanten:** voeg dedicated staging per klant toe
- **Hoge load productie:** scheid productie naar eigen VPS
- **Compliance audit (ISO 27001 / SOC 2):** documenteer scheiding formeel, voeg change advisory board toe voor productie deploys

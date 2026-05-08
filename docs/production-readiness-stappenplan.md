# BOM — Production Readiness Stappenplan

> Op maat gemaakt voor het BOM platform: multi-tenant SaaS, Next.js 15, PostgreSQL, Better Auth, Drizzle, AES-256-GCM webhook tokens, Coolify deploy, GDPR/AVG by default.
>
> **Huidige status:** ✅ Playwright E2E, ESLint, TypeScript strict, Docker, .env.example, Coolify deploy met `repository_dispatch` na succes.
>
> **Wat ontbreekt:** unit tests, pre-commit hooks, lint/typecheck CI, security scans, Dependabot, branch protection, README, ADRs, error tracking, uptime monitoring.
>
> **Tijdsinvestering:** ~12 uur eenmalig (incl. security tests), ~30 min/week onderhoud.
>
> **Aanvullend document:** [`security-test-playbook.md`](./security-test-playbook.md) — concrete test-templates voor security, authenticatie en regressie. Verwijs hiernaar in fase 2 en 2.5.

---

## Specifieke risico's voor BOM

Voordat je begint — dit zijn de plekken waar dit project extra aandacht vraagt:

1. **Multi-tenant isolatie** — één `tenant_id` filter mist en gebruiker A ziet data van gebruiker B. Tests moeten dit expliciet verifiëren (`architecture_rules.md` regel #3).
2. **Webhook crypto** — `src/lib/crypto.ts` doet AES-256-GCM. Een bug hier = lekkende of corrupte tokens. **Unit tests verplicht**.
3. **RBAC bypass** — `canDo()` is de poort. Een API-route die deze vergeet = privilege escalation. CI moet checken.
4. **GDPR/AVG** — geen Amerikaanse providers zonder goedkeuring. Voor Sentry: EU-region of self-hosted **GlitchTip**. Voor uptime: **Uptime Kuma** of EU-tier.
5. **Coolify auto-deploy op `main`** — push naar main = direct productie. Branch protection is **niet optioneel**.

---

## Fase 1 — Branch protection & GitHub basis (30 min)

### Stap 1.1: Branch protection op `main`

- [ ] **GitHub → Settings → Branches → Add branch protection rule**
- [ ] Branch name pattern: `main`
- [ ] Aanvinken:
  - `Require a pull request before merging`
  - `Require approvals: 1` (zelf-review na 24u afkoelingstijd)
  - `Dismiss stale pull request approvals when new commits are pushed`
  - `Require status checks to pass before merging` (vul straks aan met `lint`, `typecheck`, `unit-tests`, `e2e-local`)
  - `Require branches to be up to date before merging`
  - `Require conversation resolution before merging`
  - `Do not allow bypassing the above settings`

**Waarom voor BOM:** push naar main triggert automatisch een Coolify deploy. Zonder branch protection kan een halve commit van OpenCode meteen in productie staan. Dit is de #1 belangrijkste instelling.

### Stap 1.2: Repository security activeren

- [ ] **Settings → Code security and analysis** — zet aan:
  - Dependency graph
  - Dependabot alerts
  - Dependabot security updates
  - Dependabot version updates (config in stap 4.1)
  - Secret scanning + Push protection (als GitHub-tier dit toestaat — anders Gitleaks in stap 4.2)
  - Code scanning (CodeQL — config in stap 4.3)

### Stap 1.3: Repository secrets aanmaken

- [ ] **Settings → Secrets and variables → Actions**
- [ ] Voeg toe (zo nodig — sommige bestaan al):
  - `COOLIFY_DOMAIN` — al in gebruik
  - `GLITCHTIP_DSN` — straks bij stap 6.1
  - `GLITCHTIP_AUTH_TOKEN` — voor source maps upload
  - Database test-credentials zijn al geïnlined (testpassword) — laat zo

---

## Fase 2 — Unit tests toevoegen (90 min) ⭐ HOOGSTE PRIORITEIT

Het project heeft alléén E2E tests. Dat is voor `crypto.ts`, `permissions.ts` en API-route validatie veel te traag en fragiel. **Vitest** is de logische keuze (snelste, beste DX in Vite/Next ecosystem).

### Stap 2.1: Vitest installeren

- [ ] In project root:

```bash
npm i -D vitest @vitest/coverage-v8 @vitest/ui happy-dom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] Maak `vitest.config.ts` in root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/db/migrations/**',
        'src/app/**/{layout,page,loading,error,not-found}.tsx',
      ],
      thresholds: {
        // Verhoog stapsgewijs naar 80 als je tests groeien
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] Maak `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] Voeg scripts toe aan `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage"
```

### Stap 2.2: Eerste prioritaire test — `src/lib/crypto.ts`

Dit is **kritieke beveiligingscode**. Zonder tests is dit een tijdbom.

- [ ] Maak `src/lib/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './crypto';

beforeAll(() => {
  // Test-only key (64 hex chars = 32 bytes)
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
});

describe('crypto — AES-256-GCM webhook tokens', () => {
  it('roundtrip: encrypt → decrypt geeft origineel', () => {
    const plaintext = 'whk_super_secret_token_value';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produceert verschillende ciphertext bij dezelfde input (random IV)', () => {
    const plaintext = 'identical_input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('faalt bij gemanipuleerde ciphertext', () => {
    const encrypted = encrypt('original');
    const tampered = encrypted.slice(0, -2) + 'XX';
    expect(() => decrypt(tampered)).toThrow();
  });

  it('faalt op lege string input', () => {
    expect(() => encrypt('')).toThrow();
  });

  it('faalt zonder ENCRYPTION_KEY in env', () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('foo')).toThrow();
    process.env.ENCRYPTION_KEY = original;
  });
});
```

**Waarom:** AES-GCM zonder authentication-tag verificatie is geen versleuteling, alleen obfuscation. Deze tests bewijzen dat tampering wordt gedetecteerd.

### Stap 2.3: Tweede prioritaire test — `src/lib/permissions.ts`

- [ ] Maak `src/lib/permissions.test.ts` (mock de DB-call, test de logica):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { canDo } from './permissions';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    // ... mock builder pattern
  },
}));

describe('canDo — RBAC permissiecheck', () => {
  it('admin met webhooks.manage permissie → true', async () => {
    // setup mock: admin role heeft permissie
    // assert canDo(userId, tenantId, 'webhooks', 'manage') === true
  });

  it('member zonder schrijfrechten → false', async () => {
    // assert canDo(userId, tenantId, 'assistants', 'create') === false
  });

  it('user uit andere tenant → false (cross-tenant blokkade)', async () => {
    // KRITIEK: zelfde rol in andere tenant geeft geen rechten
  });

  it('niet-bestaande permissie → false', async () => {
    // assert canDo(userId, tenantId, 'fake', 'action') === false
  });
});
```

**Waarom:** elke API-route gebruikt `canDo()`. Een bug hier = volledige RBAC bypass.

### Stap 2.4: Zod-schema validatie tests

Voor elke API-route met een Zod schema (`/api/assistants`, `/api/webhooks/tokens`, etc.):

- [ ] Schrijf snelle tests die het schema testen — null, leeg, te lang, verkeerd type. AI is geneigd om alleen de happy path te valideren.

**Waarom:** input validation is je eerste defensielinie. Zod schema's worden vaak door OpenCode gegenereerd met te losse types (`.optional()` waar `.required()` moet).

### Stap 2.5: Multi-tenant isolatie test

- [ ] Maak een integration test in `e2e/tenant-isolation.spec.ts`:
  - Login als gebruiker A in tenant 1
  - Probeer een resource van tenant 2 op te halen via de API
  - Verifieer 403 of 404 (nooit 200 met data)

**Waarom:** dit is de #1 multi-tenant bug. Een ontbrekend `tenant_id` filter is onzichtbaar tot het misgaat. Architecture rules eisen dit expliciet.

---

## Fase 2.5 — Security & authenticatie tests (4 uur) ⭐ NIEUW

> **Volledige test-templates** staan in [`security-test-playbook.md`](./security-test-playbook.md). Dit hoofdstuk is de checklist; het playbook is de naslag.

Voor BOM zijn drie test-categorieën verplicht voordat de eerste echte tenant op productie gaat. Ze zitten bewust apart van de "gewone" unit tests in fase 2 omdat ze specifieke setup nodig hebben (test-fixtures, multi-tenant data).

### Stap 2.5.1: Test-fixtures opzetten

- [ ] Maak `src/__tests__/fixtures/users.ts` — helpers voor `createTestTenant`, `createTestUser`, `cleanupTestData`
- [ ] Maak `e2e/helpers/auth.ts` — `loginAs()` helper voor Playwright cookies
- [ ] Map-structuur:
  - `src/__tests__/unit/` — pure logica
  - `src/__tests__/integration/` — DB-touchend
  - `src/__tests__/regressions/` — bug-regression tests
  - `e2e/security/` — security E2E

**Waarom:** zonder fixtures schrijf je dezelfde setup-code 20x. Eén keer goed neerzetten = alle volgende tests veel sneller.

### Stap 2.5.2: Authenticatie E2E tests — `e2e/security/auth-security.spec.ts`

Schrijf tests voor:

- [ ] Login met fout wachtwoord → 401, geen sessie cookie
- [ ] Login met niet-bestaande email → identieke foutmelding (geen user enumeration)
- [ ] Verlopen sessie → redirect naar /login
- [ ] Logout invalideert sessie aan server-side (oude cookie werkt niet meer)
- [ ] Sessie cookie heeft `HttpOnly`, `Secure` (HTTPS), `SameSite=Lax`
- [ ] Magic link is single-use (tweede klik faalt)
- [ ] Magic link verloopt na 15 min
- [ ] Rate limiting: 5x fout wachtwoord → 429

**Waarom:** Better Auth doet veel goed, maar configuratie-fouten zijn de norm. Deze tests vangen ze.

### Stap 2.5.3: RBAC + Tenant isolatie tests — kritiek

Splits in twee bestanden:

- [ ] `src/lib/permissions.test.ts` — unit, mocked DB
  - admin met permissie → true
  - member zonder permissie → false
  - admin van tenant A vraagt rechten in tenant B → false
  - SQL-injectie in resource/action → false (geen crash)

- [ ] `e2e/security/tenant-isolation.spec.ts` — E2E met echte data
  - admin A ziet alleen eigen assistants in `/api/assistants`
  - admin A krijgt 403/404 op directe GET `/api/assistants/{id-van-B}`
  - admin A kan resource van tenant B niet wijzigen of verwijderen
  - Manipulatie van `tenantId` in request body wordt genegeerd (server gebruikt sessie)

- [ ] `e2e/security/rbac-write-blocks.spec.ts` — member kan geen schrijfacties
  - member krijgt 403 op POST/PATCH/DELETE op alle write-endpoints (assistants, webhooks/tokens, assistant-runs)
  - Loop met `test.each` over alle write-endpoints

**Waarom:** dit is BOM's #1 risico — multi-tenant data leak. Zonder deze tests heb je geen bewijs dat tenant isolation werkt.

### Stap 2.5.4: Webhook security tests — `src/__tests__/integration/webhooks.test.ts`

- [ ] Geen Authorization header → 401
- [ ] Fout bearer token → 401
- [ ] Geldig token → 200/202
- [ ] Ingetrokken token (`revokedAt` set) → 401
- [ ] Payload > 1 MB → 413 (DoS-bescherming)
- [ ] Malformed JSON → 400 zonder stack trace lekken
- [ ] Webhook token in DB is encrypted (geen plaintext)

**Waarom:** webhooks zijn extern bereikbaar — bearer auth is je enige verdediging. Eén bug = data-injectie van willekeurige attacker.

### Stap 2.5.5: Crypto tests uitbreiden — `src/lib/crypto.test.ts`

Bovenop fase 2:

- [ ] 100x encrypt zelfde input → 100 unieke ciphertexts (random IV)
- [ ] Tampering met auth-tag → throws (GCM integrity)
- [ ] Decrypt met andere key → throws (key rotation simulatie)
- [ ] Performance: < 5ms per encrypt-call (webhook hot path)

**Waarom:** AES-GCM zonder auth-tag verificatie is geen security. Tests bewijzen dat tampering wordt gedetecteerd.

### Stap 2.5.6: Input validatie tests — per API route

Voor elke schrijf-route minstens deze tests in `src/__tests__/integration/`:

- [ ] Lege body → 400
- [ ] Ontbrekende verplichte velden → 400 met Zod-details
- [ ] Extra velden worden geweigerd of gestript (Zod strict)
- [ ] SQL-injectie in string-veld → opgeslagen als string, geen DB-impact
- [ ] XSS-payload blijft escaped in response
- [ ] Oversized payload (>1 MB) → 413
- [ ] Malformed JSON → 400 zonder stack trace

**Waarom:** OpenCode genereert vaak Zod-schemas die te tolerant zijn (`.optional()` waar `.required()` moet). Tests forceren strenge validatie.

### Stap 2.5.7: Headers & transport security — `e2e/security/headers.spec.ts`

- [ ] Productie response heeft `Strict-Transport-Security` met max-age
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` of CSP `frame-ancestors 'none'`
- [ ] `Content-Security-Policy` aanwezig
- [ ] `Referrer-Policy` is `strict-origin-when-cross-origin` of `no-referrer`
- [ ] Geen `X-Powered-By` of versie-header

**Waarom:** Next.js heeft hier defaults voor maar je moet ze expliciet aanzetten in `next.config.ts`. Test forceert de configuratie.

### Stap 2.5.8: Rate limiting tests — `e2e/security/rate-limiting.spec.ts`

- [ ] Login endpoint: 5 fouten in 1 min → 429 met `Retry-After` header
- [ ] Webhook inbound: rate limit volgens design-keuze (documenteer expliciet)

**Waarom:** brute force, credential stuffing en DoS aanvallen worden hierdoor geblokkeerd.

### Stap 2.5.9: Coverage targets vastleggen

Update `vitest.config.ts` met per-bestand thresholds:

```typescript
coverage: {
  thresholds: {
    'src/lib/crypto.ts': { lines: 100, functions: 100, branches: 100 },
    'src/lib/permissions.ts': { lines: 95, functions: 95, branches: 95 },
    'src/lib/auth.ts': { lines: 80, functions: 80, branches: 75 },
    'src/app/api/**': { lines: 70, functions: 70, branches: 65 },
  },
}
```

**Waarom:** een gemiddelde coverage van 70% kan betekenen dat crypto 0% heeft. Per-bestand thresholds dwingen af dat de kritieke files volledig getest zijn.

---

## Fase 3 — CI uitbreiden (45 min)

Je hebt nu één workflow (`playwright.yml`). Die blijft staan, maar er moet een snellere "checks" workflow bij die op elke PR draait.

### Stap 3.1: Lint, typecheck en unit-tests workflow

- [ ] Maak `.github/workflows/checks.yml`:

```yaml
name: Checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  unit-tests:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run Vitest met coverage
        env:
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
        run: npm run test:coverage
      - name: Upload coverage rapport
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 14

  build:
    name: Next.js build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Build
        env:
          DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
          BETTER_AUTH_SECRET: build-only-secret-min-32-chars!!!!
          BETTER_AUTH_URL: http://localhost:3000
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
        run: npm run build
```

### Stap 3.2: Activeer als required checks

- [ ] Wacht tot deze workflow 1x gedraaid heeft op een PR
- [ ] **Settings → Branches → main → Edit** — voeg toe aan required checks:
  - `Lint`
  - `TypeScript`
  - `Unit tests` (incl. crypto, permissions, validatie)
  - `Next.js build`
  - `E2E — Dev server` (de bestaande Playwright job, draait ook security E2E)
  - `npm audit`

**Waarom:** vóór deze stap is je CI cosmetisch. Deze stap maakt de checks verplicht — een rode CI kan niet meer naar main, dus niet meer naar Coolify productie.

### Stap 3.3: ESLint config aanscherpen voor BOM

- [ ] Voeg toe aan `eslint.config.mjs`:

```javascript
{
  rules: {
    // Voorkom directe rbac.* queries (alleen via canDo)
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/db/schema/rbac'],
        message: 'Gebruik canDo() uit @/lib/permissions in plaats van directe RBAC queries (zie architecture_rules.md)',
      }],
    }],
    // Geen 'any'
    '@typescript-eslint/no-explicit-any': 'error',
    // Geen console.log in productie code (gebruik gestructureerd logger)
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}
```

**Waarom:** dit zijn jouw eigen architectuurregels, geforceerd door de linter. Voorkomt dat OpenCode per ongeluk een rbac.* tabel direct queryt buiten `permissions.ts`.

---

## Fase 4 — Security automation (45 min)

### Stap 4.1: Dependabot config

- [ ] Maak `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Amsterdam"
    open-pull-requests-limit: 10
    groups:
      next-ecosystem:
        patterns: ["next", "eslint-config-next", "@next/*"]
      react-ecosystem:
        patterns: ["react", "react-dom", "@types/react", "@types/react-dom"]
      drizzle-ecosystem:
        patterns: ["drizzle-orm", "drizzle-kit", "postgres"]
      auth:
        patterns: ["better-auth", "jose"]
      tailwind-ecosystem:
        patterns: ["tailwindcss", "@tailwindcss/*", "tailwind-merge", "tw-animate-css"]
      dev-dependencies:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      production-minor:
        dependency-type: "production"
        update-types: ["minor", "patch"]
    ignore:
      # Pin major versions voor breaking change control
      - dependency-name: "next"
        update-types: ["version-update:semver-major"]
      - dependency-name: "react"
        update-types: ["version-update:semver-major"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Waarom:** zonder dit verouder je dependencies stilletjes. Better Auth, Drizzle en Next krijgen vaak security-patches. Groepering houdt het overzichtelijk: één PR per ecosystem in plaats van 30 losse.

### Stap 4.2: Gitleaks workflow

- [ ] Maak `.github/workflows/gitleaks.yml`:

```yaml
name: Gitleaks
on:
  pull_request:
  push:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Waarom:** vangt per ongeluk gecommitte `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, S3 credentials etc. Eén lek = alle webhook tokens te ontsleutelen. **Niet onderhandelbaar voor BOM**.

### Stap 4.3: CodeQL voor SAST

- [ ] **Security tab → Code scanning → Set up → CodeQL → Default**
- [ ] Of maak `.github/workflows/codeql.yml` met advanced config voor JavaScript/TypeScript

**Waarom:** GitHub's eigen statische analyse vangt SQL-injection patterns, XSS in React, path traversal. Gratis voor jouw setup.

### Stap 4.4: Trivy voor Docker image

Je hebt een Dockerfile en die wordt door Coolify gebouwd. Scan de image op CVE's.

- [ ] Maak `.github/workflows/trivy.yml`:

```yaml
name: Trivy container scan
on:
  pull_request:
    paths:
      - 'Dockerfile'
      - 'package*.json'
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # wekelijks maandag

jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image lokaal
        run: docker build -t bom-scan:latest .
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'bom-scan:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
      - name: Upload SARIF naar GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
```

**Waarom:** je base image (Node 20 alpine of vergelijkbaar) krijgt periodiek CVE's. Wekelijkse scan voorkomt dat je met een kwetsbare image draait zonder het te weten.

### Stap 4.5: Dependency review action (op PR's)

- [ ] Maak `.github/workflows/dependency-review.yml`:

```yaml
name: Dependency review
on:
  pull_request:
    branches: [main]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          deny-licenses: GPL-3.0, AGPL-3.0  # als je commerciële code hebt
```

**Waarom:** blokkeert PR's die kwetsbare of incompatibel-gelicenseerde packages toevoegen vóór ze gemerged worden.

### Stap 4.6: OWASP ZAP baseline scan (wekelijks)

- [ ] Maak `.github/workflows/zap-baseline.yml`:

```yaml
name: OWASP ZAP baseline
on:
  schedule:
    - cron: '0 4 * * 1'  # maandag 04:00 NL-tijd
  workflow_dispatch:

jobs:
  zap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ secrets.STAGING_URL }}
          rules_file_name: '.zap/rules.tsv'
          allow_issue_writing: true
          fail_action: false  # rapporteer maar blokkeer niet
```

- [ ] Voeg `STAGING_URL` toe aan GitHub Secrets
- [ ] Maak `.zap/rules.tsv` om false positives te onderdrukken (volgt na eerste run)

**Waarom:** ZAP simuleert een attacker en vindt configuration-issues die unit tests missen (CSP-gaten, oude TLS, missing headers). Wekelijks is voldoende — te traag voor elke PR.

---

## Fase 5 — Code kwaliteit (45 min)

### Stap 5.1: Prettier toevoegen

- [ ] `npm i -D prettier eslint-config-prettier`
- [ ] Maak `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] Maak `.prettierignore`:

```
node_modules
.next
coverage
playwright-report
test-results
src/db/migrations
*.lock
```

- [ ] Voeg toe aan `package.json` scripts:

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] Update `eslint.config.mjs` om Prettier-conflicten te voorkomen:

```javascript
import prettierConfig from 'eslint-config-prettier';

export default [
  // ... bestaande config
  prettierConfig,  // moet als laatste
];
```

### Stap 5.2: .editorconfig

- [ ] Maak `.editorconfig` in root:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2
```

### Stap 5.3: Husky + lint-staged (pre-commit)

- [ ] Installeren:

```bash
npm i -D husky lint-staged
npx husky init
```

- [ ] Vervang `.husky/pre-commit` door:

```bash
npx lint-staged
```

- [ ] Voeg toe aan `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

- [ ] Maak `.husky/pre-push`:

```bash
npm run typecheck
npm run test
```

**Waarom:** vangt fouten in 5 sec op je laptop in plaats van 3 min in CI. Pre-push draait de "duurdere" checks (types + tests) zodat je niet kapotte code pusht.

### Stap 5.4: Pull Request template

- [ ] Maak `.github/pull_request_template.md`:

```markdown
## Wat verandert er?

<!-- 1-3 zinnen, in het Nederlands -->

## Waarom?

<!-- Link issue / context / business reden -->

## Type wijziging

- [ ] Bugfix (non-breaking)
- [ ] Nieuwe feature (non-breaking)
- [ ] Breaking change
- [ ] Documentatie / refactor

## Hoe getest?

- [ ] Unit tests toegevoegd / aangepast
- [ ] Edge cases (null, leeg, te lang) gedekt
- [ ] Failure mode getest (DB down, timeout, ongeldige input)
- [ ] E2E test waar relevant
- [ ] Handmatig getest in: <!-- lokaal / staging -->

## BOM-specifieke checks

- [ ] **Tenant isolation**: alle queries op `app.*` of `iam.*` filteren op `tenant_id`
- [ ] **RBAC**: nieuwe schrijfoperatie heeft `if (!await canDo(...)) return 403`
- [ ] **Input validation**: Zod schema voor request body / params
- [ ] **Geen directe `rbac.*` queries** buiten `src/lib/permissions.ts`
- [ ] **Geen PII in logs** (geen email, naam, token in `console.log` of error messages)
- [ ] **Geen Amerikaanse providers** zonder expliciete goedkeuring
- [ ] **DB roundtrips**: gebruikt joins waar mogelijk (geen N+1)

## AI-code review checklist

- [ ] Geen verzonnen libraries / functies (npm install gechecked?)
- [ ] Error handling op alle externe calls (DB, S3, webhook)
- [ ] Geen hardcoded secrets / URLs / IDs
- [ ] Ik kan elke regel uitleggen

## Migraties

- [ ] Geen schema-wijziging, of:
- [ ] `npm run db:generate` uitgevoerd, migratie reviewed
- [ ] Migratie is reversible / heeft een rollback plan
```

**Waarom:** dwingt jezelf en OpenCode om de juiste BOM-specifieke vragen te beantwoorden voor elke PR.

### Stap 5.5: CODEOWNERS

- [ ] Maak `.github/CODEOWNERS`:

```
# Alle bestanden — Jaap is default reviewer
* @jaaphoeve

# Kritieke gebieden — extra aandacht
/src/lib/crypto.ts @jaaphoeve
/src/lib/permissions.ts @jaaphoeve
/src/lib/auth.ts @jaaphoeve
/src/db/schema/ @jaaphoeve
/.github/ @jaaphoeve
/.claude/rules/ @jaaphoeve
/Dockerfile @jaaphoeve
```

**Waarom:** automatische review-flag voor security-kritieke files. Solo-projecten: dwingt extra alertheid bij wijzigingen aan crypto/auth/RBAC.

---

## Fase 6 — Productie observability (60 min)

### Stap 6.1: Error tracking met GlitchTip (GDPR-compliant)

Sentry zit in de VS — voor BOM (GDPR by default) niet acceptabel zonder DPA. **GlitchTip** is een open-source Sentry-alternatief, self-host op Coolify naast je app.

- [ ] Deploy GlitchTip op Coolify (officiële Docker image: `glitchtip/glitchtip`)
- [ ] Maak project `bom-production`, kopieer DSN
- [ ] Voeg `GLITCHTIP_DSN` toe aan GitHub Secrets én Coolify env
- [ ] Installeer Sentry SDK (compatibel met GlitchTip):

```bash
npm i @sentry/nextjs
```

- [ ] Run `npx @sentry/wizard@latest -i nextjs` (handmatig DSN invullen)
- [ ] Wijzig `sentry.client.config.ts` en `sentry.server.config.ts`:
  - `dsn: process.env.GLITCHTIP_DSN` (in plaats van Sentry default)
  - `tracesSampleRate: 0.1` (10% — bespaart kwota)
  - `beforeSend(event)`: filter PII (email, naam) uit events

**Alternatief als je geen self-hosting wilt:** Sentry **EU-region** (`https://*.sentry.io` met EU data residency) — vraag offerte voor team-tier (~€26/maand).

**Waarom:** zonder error tracking ben je blind in productie. Een gebruiker meldt "het werkt niet" — zonder events ben je een uur kwijt. **Belangrijk voor BOM**: de PII-filter moet aan, want stack traces van API-routes bevatten regelmatig email/naam in argument-values.

### Stap 6.2: Uptime monitoring met Uptime Kuma

- [ ] Deploy Uptime Kuma op Coolify (`louislam/uptime-kuma`)
- [ ] Voeg HTTPS-monitor toe voor productie URL
- [ ] Voeg keyword-monitor toe (`/api/health` endpoint dat database raakt — zie 6.3)
- [ ] Stel Telegram of email-notificatie in

**Waarom:** weet binnen 1 min of productie down is, niet pas als een klant belt. Self-hosted = geen abonnementen, geen US-data.

### Stap 6.3: Health check endpoint

- [ ] Maak `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // DB-roundtrip om te bewijzen dat connectie werkt
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Database unreachable' },
      { status: 503 }
    );
  }
}
```

**Waarom:** `/health` is wat Coolify, Uptime Kuma en straks load-balancers controleren. Moet de écht-werkende staat reflecteren (= DB bereikbaar), niet alleen "Next.js draait".

### Stap 6.4: Gestructureerde logging

- [ ] Installeer pino:

```bash
npm i pino pino-pretty
```

- [ ] Maak `src/lib/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.email',
      '*.encryptionKey',
      'ENCRYPTION_KEY',
      'BETTER_AUTH_SECRET',
    ],
    censor: '[REDACTED]',
  },
});
```

- [ ] Vervang `console.log` calls door `logger.info` etc. (laat dit door OpenCode doen, scan met grep)

**Waarom:** structured logs zijn doorzoekbaar (`logger.info({ tenantId, assistantId }, 'run created')`) en de redact-config voorkomt dat je per ongeluk PII of secrets logt — wat AVG-overtreding zou zijn.

---

## Fase 7 — Documentatie (30 min)

### Stap 7.1: README.md aanmaken

- [ ] Maak `README.md` in root met:
  - Wat is BOM (1 alinea)
  - Stack
  - Setup-instructies (`.env.local` aanmaken, `npm install`, `npm run db:migrate`, `npm run dev`)
  - Tests draaien (unit + e2e)
  - Deploy (push naar main triggert Coolify)
  - Link naar `.claude/rules/` voor architectuurregels

**Waarom:** zonder README is een nieuwe collega (of toekomstige jij over 6 maanden) een halve dag kwijt aan setup uitvogelen.

### Stap 7.2: ADR-structuur

- [ ] Maak `docs/adr/0001-stack-keuze.md`, `0002-multi-tenant-strategie.md`, `0003-aes-256-gcm-webhook-tokens.md`
- [ ] Format: Context → Beslissing → Gevolgen → Status (geaccepteerd / vervangen door X)

**Waarom:** over een jaar weet je niet meer waarom je voor `postgres-js` koos in plaats van `pg`, of waarom AES-GCM in plaats van AES-CBC. ADRs zijn 10 min werk per stuk.

---

## Fase 8 — Onderhoud (doorlopend)

### Stap 8.1: Wekelijks ritueel

- [ ] **Maandag 30 min:** review Dependabot PR's, merge wat groen is
- [ ] **Maandag 15 min:** check GlitchTip dashboard voor nieuwe error patterns
- [ ] **Maandag 15 min:** check GitHub Security tab voor alerts

### Stap 8.2: Geautomatiseerd onderhoud (Cowork scheduled task)

- [ ] Voeg toe aan `~/.claude/CLAUDE.md` als nieuwe scheduled task:

```
| `bom-security-check` | Maandag 09:30 | Review open Dependabot PRs, GitHub Security alerts en GlitchTip top errors voor BOM. Schrijf rapport naar `.claude/rapportages/bom-security-YYYY-MM-DD.md` |
```

**Waarom:** het wekelijks ritueel kun je automatiseren met je bestaande Cowork scheduled tasks. Past in je bestaande workflow.

---

## Fase 9 — Regressie-discipline (geen tijd, maar discipline) ⭐ NIEUW

Geen tools, alleen een werkwijze. Maar zonder dit verlies je de waarde van fase 2 en 2.5 binnen een half jaar.

### Stap 9.1: Bug-naar-test workflow vastleggen

Voor **elke** productiebug, in deze volgorde:

1. **Reproduceer** lokaal (kopieer Sentry/GlitchTip event data)
2. **Schrijf een falende test** die de bug demonstreert
3. **Fix de code** tot test groen wordt
4. **Merge** met test inbegrepen

- [ ] Update `.github/pull_request_template.md` met sectie:

```markdown
## Regressietest (verplicht bij bugfix)

- [ ] Geen bugfix, of:
- [ ] Falende test geschreven vóór de fix (commit hash: `xxx`)
- [ ] Test bestaat in `src/__tests__/regressions/` met `// REGRESSION: <issue-link>` comment
```

### Stap 9.2: Map-structuur voor regressies

- [ ] Maak `src/__tests__/regressions/` map met README:

```markdown
# Regression tests

Voor elke productiebug komt hier een test die de bug specifiek vangt.

## Naamgeving

`<issue-id>-<korte-beschrijving>.test.ts`

Voorbeeld: `gh-142-revoked-webhook-token-accepted.test.ts`

## Regels

- Nooit verwijderen, ook niet als de feature verandert
- Bij refactor: aanpassen, niet weggooien
- Skipped tests = open bug → kwartaalreview verplicht
```

### Stap 9.3: Sentry/GlitchTip → ticket → test pipeline

- [ ] In GlitchTip: configureer webhook naar GitHub Issues voor errors met severity `error` en hoger
- [ ] Issue-template `bug_report.md`:

```markdown
**Gevonden via:** Sentry/GlitchTip event #...
**Reproductie stappen:**
**Verwacht gedrag:**
**Werkelijk gedrag:**

## Definition of done

- [ ] Reproductie lokaal bevestigd
- [ ] Falende regressietest geschreven (PR-commit: `xxx`)
- [ ] Fix geïmplementeerd
- [ ] Test groen
- [ ] PR gemerged
```

### Stap 9.4: Kwartaalreview

- [ ] Voeg toe aan Cowork scheduled tasks (`~/.claude/CLAUDE.md`):

```
| `bom-regression-review` | 1e maandag van het kwartaal 09:00 | Scan src/__tests__/regressions/ en e2e/ op .skip(), todo:, fixme:. Schrijf rapport met open regressies naar .claude/rapportages/ |
```

**Waarom:** een geskipte regressietest betekent: bug kan terugkomen. Kwartaalreview voorkomt dat skips zich opstapelen tot je test-suite alleen nog de happy path test.

### Stap 9.5: Coverage van regression-tests bewaken

- [ ] CI faalt als bestanden in `src/__tests__/regressions/` worden verwijderd zonder uitleg
- [ ] Optioneel: pre-commit hook die waarschuwt bij `.skip` of `xtest` toegevoegd zonder TODO-comment

**Waarom:** regression-tests mogen niet stilletjes verdwijnen. Een verwijderde test = een vergeten bug die kan terugkomen.

---

## Eindcontrole — productie-klaar?

Vink af voordat de eerste echte tenant in BOM komt:

**Branch & CI**
- [ ] Branch protection actief op main, niet bypassbaar
- [ ] Alle 6 required CI checks groen op laatste merge: `Lint`, `TypeScript`, `Unit tests`, `Next.js build`, `E2E — Dev server`, `npm audit`

**Test coverage (zie playbook voor details)**
- [ ] `src/lib/crypto.ts` op 100% coverage
- [ ] `src/lib/permissions.ts` op 95%+ coverage
- [ ] Per-bestand thresholds in `vitest.config.ts` actief
- [ ] Globale coverage minstens 60% (groeit naar 80%)

**Security tests aanwezig (fase 2.5)**
- [ ] `e2e/security/auth-security.spec.ts` — login, sessie, magic link, rate limiting
- [ ] `e2e/security/tenant-isolation.spec.ts` — admin A kan niet bij data van tenant B
- [ ] `e2e/security/rbac-write-blocks.spec.ts` — member krijgt 403 op alle write endpoints
- [ ] `src/__tests__/integration/webhooks.test.ts` — bearer auth, revoked tokens, payload limits
- [ ] `src/__tests__/integration/api-validation.test.ts` — Zod, SQL-injectie, XSS, oversize
- [ ] `e2e/security/headers.spec.ts` — CSP, HSTS, X-Frame-Options aanwezig in productie

**Security automation actief**
- [ ] Geen openstaande Dependabot security alerts
- [ ] CodeQL en/of Semgrep groen
- [ ] Trivy scant Docker image wekelijks
- [ ] OWASP ZAP baseline scan geconfigureerd

**Productie tooling**
- [ ] GlitchTip ontvangt errors uit productie, PII wordt geredacteerd
- [ ] Uptime Kuma actief op `/api/health`
- [ ] Rollback-procedure getest (Coolify revert naar vorige image)
- [ ] Database backups bestaan (Coolify of Hetzner) en restore is 1x getest

**Documentatie & discipline**
- [ ] `.env.example` compleet, README beschrijft setup
- [ ] `docs/security-test-playbook.md` aanwezig
- [ ] Bug-regressie workflow gedocumenteerd in PR template
- [ ] `src/__tests__/regressions/` map bestaat met README
- [ ] AVG/GDPR check: geen Amerikaanse providers in productie pad

---

## Tijdsplanning

| Fase | Tijd | Wanneer |
|------|------|---------|
| 1. Branch protection | 30 min | Vandaag — meest kritisch |
| 2. Unit tests (crypto + permissions) | 90 min | Vandaag/morgen — security |
| **2.5. Security & auth tests** | **4 uur** | **Deze week — verplicht voor productie** |
| 3. CI uitbreiden (incl. security checks) | 45 min | Na fase 2.5 |
| 4. Security automation (incl. ZAP) | 60 min | Deze week |
| 5. Code kwaliteit | 45 min | Deze week |
| 6. Observability | 60 min | Voor eerste live tenant |
| 7. Documentatie | 30 min | Tussendoor |
| 8. Onderhoud opzetten | 15 min | Eind van setup |
| 9. Regressie-discipline | 30 min eenmalig | Doorlopend werkwijze |

**Totaal: ~12 uur eenmalig.** Doe het verspreid over 5-7 dagen, niet in één ruk.

---

## Volgordelogica

De volgorde is bewust gekozen:

1. **Branch protection eerst** → voorkomt dat alle latere setup-werk om gehackt wordt door een directe push naar main
2. **Unit tests tweede** → voorkomt dat fase 3+ regressies introduceren in `crypto.ts` of `permissions.ts`
3. **Security tests (2.5) derde** → bewijst dat tenant-isolatie en RBAC werken vóór CI ze afdwingt
4. **CI vierde** → maakt alle tests verplicht — een rode CI kan niet meer naar Coolify productie
5. **Security automation vijfde** → vangt CVE's en config-issues voor ze productie raken
6. **Code kwaliteit zesde** → verlaagt review-friction (auto-format, pre-commit)
7. **Observability zevende** → kun je niet zonder als er echte gebruikers zijn
8. **Documentatie achtste** → mag laat, maar niet overslaan
9. **Onderhoud negende** → houdt het systeem in stand
10. **Regressie-discipline tiende** → het verschil tussen een test-suite die groeit en een die verschraalt

---

## Wat ik bewust **niet** opneem (en waarom)

- **Codecov / SonarCloud** — overkill voor solo-project en deels US-hosted. Coverage HTML als artifact in CI is voldoende.
- **Sentry US** — niet GDPR-compliant zonder DPA. GlitchTip self-hosted op Coolify is gratis en gelijkwaardig.
- **Datadog / New Relic** — €100+/maand. Pas zinvol bij echt productieverkeer. Coolify metrics + GlitchTip is voldoende voor de eerste 1000 users.
- **Mutation testing (Stryker)** — voeg later toe als unit-test suite groeit. Nu te traag voor de payoff.
- **Renovate ipv Dependabot** — Dependabot doet wat je nodig hebt. Renovate's extra config-vrijheid haal je nu nog niet op.

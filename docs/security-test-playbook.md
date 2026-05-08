# BOM — Security Test Playbook

> Naslagwerk voor het schrijven van security-, authenticatie- en regressietests in BOM.
>
> **Doelgroep:** jij + AI-assistenten (OpenCode/Claude). Verwijs naar dit document bij elke PR met security-impact.
>
> **Aanvulling op:** [`production-readiness-stappenplan.md`](./production-readiness-stappenplan.md). Het stappenplan beschrijft *welke* fases, dit playbook beschrijft *welke tests* in elke fase.

---

## Waarom dit document bestaat

Bij elke nieuwe feature in BOM zijn er drie soorten tests die snel vergeten worden:

1. **Authenticatie** — werkt login/logout/sessie nog correct?
2. **Autorisatie** — kan een gebruiker alleen wat z'n rol toelaat, alleen binnen zijn tenant?
3. **Input/crypto/headers** — wordt misbruik geweigerd?

Dit playbook bevat per categorie **concrete code-templates** die je (of OpenCode) kunt kopiëren en aanpassen. Niet abstract advies — werkende voorbeelden voor de BOM stack: Vitest, Playwright, Better Auth, Drizzle, Next.js App Router.

---

## Test-architectuur

Drie lagen, elk met een eigen rol:

```
┌─────────────────────────────────────────────┐
│  E2E (Playwright) — gebruiker-perspectief   │
│  • Auth flows, RBAC bypass, tenant isolatie  │
│  • Headers, rate limiting                    │
│  • Traag, ~2-5 min                          │
├─────────────────────────────────────────────┤
│  Integration (Vitest + Drizzle test DB)     │
│  • API route handlers met echte DB           │
│  • Webhook flows                             │
│  • Middleweg: ~10-30 sec                    │
├─────────────────────────────────────────────┤
│  Unit (Vitest, in-memory)                   │
│  • crypto.ts, permissions.ts (mocked DB)     │
│  • Zod schemas                               │
│  • Snel, < 1 sec                            │
└─────────────────────────────────────────────┘
```

**Vuistregel:** schrijf de test op de laagst mogelijke laag. Crypto = unit. RBAC met DB = integration. Login flow = E2E.

---

## Test-fixtures opzetten

Voordat je tests schrijft, heb je herbruikbare fixtures nodig. Maak deze één keer.

### `src/__tests__/fixtures/users.ts`

```typescript
import { db } from '@/db';
import { users, sessions } from '@/db/schema/auth';
import { tenants, tenantMembers } from '@/db/schema/iam';
import { roles, rolePermissions, permissions } from '@/db/schema/rbac';
import { randomUUID } from 'node:crypto';

export interface TestUser {
  userId: string;
  email: string;
  tenantId: string;
  role: 'admin' | 'member';
  sessionToken: string;
}

export async function createTestTenant(name = 'Test Tenant'): Promise<string> {
  const tenantId = randomUUID();
  await db.insert(tenants).values({ id: tenantId, name, slug: `test-${tenantId.slice(0, 8)}` });
  return tenantId;
}

export async function createTestUser(opts: {
  tenantId: string;
  role: 'admin' | 'member';
  email?: string;
}): Promise<TestUser> {
  const userId = randomUUID();
  const email = opts.email ?? `test-${userId}@example.com`;
  const sessionToken = randomUUID();

  await db.insert(users).values({ id: userId, email, name: 'Test User', emailVerified: true });
  await db.insert(tenantMembers).values({
    userId,
    tenantId: opts.tenantId,
    roleId: opts.role,
  });
  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    token: sessionToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return { userId, email, tenantId: opts.tenantId, role: opts.role, sessionToken };
}

export async function cleanupTestData(tenantId: string): Promise<void> {
  // Verwijder in juiste volgorde door FK constraints
  // Pas aan op basis van je werkelijke schema
}
```

### `e2e/helpers/auth.ts` (Playwright)

```typescript
import { Page, BrowserContext } from '@playwright/test';

export async function loginAs(
  context: BrowserContext,
  opts: { email: string; sessionToken: string }
): Promise<void> {
  await context.addCookies([
    {
      name: 'better-auth.session_token',
      value: opts.sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function expectUnauthorized(page: Page, url: string): Promise<void> {
  const response = await page.request.get(url);
  if (response.status() !== 401 && response.status() !== 403) {
    throw new Error(`Verwachtte 401/403 op ${url}, kreeg ${response.status()}`);
  }
}
```

---

## 1. Authenticatie (Better Auth)

### Wat test je en waarom

Better Auth doet veel goed out-of-the-box, maar **configuratie-fouten zijn de norm**. Test of je deployment de defaults niet sloopt.

### Tests — `e2e/auth-security.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authenticatie security', () => {
  test('login met fout wachtwoord → 401, geen sessie cookie', async ({ page }) => {
    const response = await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'bestaand@example.com', password: 'fout-wachtwoord' },
    });
    expect(response.status()).toBe(401);
    const cookies = (await page.context().cookies()).filter(c => c.name.includes('session'));
    expect(cookies).toHaveLength(0);
  });

  test('login met niet-bestaande email → zelfde foutmelding (geen user enumeration)', async ({ page }) => {
    const r1 = await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'bestaat-niet@example.com', password: 'whatever' },
    });
    const r2 = await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'bestaand@example.com', password: 'fout' },
    });
    // Beide moeten zelfde status + body teruggeven, anders kun je accounts enumereren
    expect(r1.status()).toBe(r2.status());
    expect(await r1.text()).toBe(await r2.text());
  });

  test('verlopen sessie → redirect naar login op beschermde pagina', async ({ context, page }) => {
    await context.addCookies([{
      name: 'better-auth.session_token',
      value: 'verlopen-of-fake-token',
      domain: 'localhost',
      path: '/',
    }]);
    const response = await page.goto('/dashboard');
    expect(page.url()).toContain('/login');
  });

  test('logout invalideert sessie aan server-side', async ({ page, context }) => {
    // Login eerst
    await page.goto('/login');
    // ... login flow
    const cookies = await context.cookies();
    const sessionToken = cookies.find(c => c.name.includes('session_token'))?.value;

    // Logout
    await page.request.post('/api/auth/sign-out');

    // Probeer met dezelfde cookie weer in te loggen
    const response = await page.request.get('/api/dashboard/metrics', {
      headers: { Cookie: `better-auth.session_token=${sessionToken}` },
    });
    expect(response.status()).toBe(401);
  });

  test('sessie cookie heeft HttpOnly, Secure (in productie), SameSite', async ({ page }) => {
    // Productie-test: PLAYWRIGHT_BASE_URL moet HTTPS zijn
    if (!process.env.PLAYWRIGHT_BASE_URL?.startsWith('https')) test.skip();

    await page.goto('/login');
    // ... voltooi login
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name.includes('session'));
    expect(session?.httpOnly).toBe(true);
    expect(session?.secure).toBe(true);
    expect(['Lax', 'Strict']).toContain(session?.sameSite);
  });

  test('rate limiting na 5 fouten op login → 429', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.request.post('/api/auth/sign-in/email', {
        data: { email: 'rate-limit-test@example.com', password: 'fout' },
      });
    }
    const sixth = await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'rate-limit-test@example.com', password: 'fout' },
    });
    expect(sixth.status()).toBe(429);
  });
});
```

### Magic link specifieke tests

```typescript
test('magic link is single-use', async ({ page }) => {
  // Trigger magic link
  await page.request.post('/api/auth/magic-link', {
    data: { email: 'test@example.com' },
  });
  // Vis link op uit test-mail server (Mailpit) of test-only API
  const link = await fetchLatestMagicLink('test@example.com');

  // Eerste klik werkt
  const r1 = await page.request.get(link);
  expect(r1.status()).toBe(200);

  // Tweede klik faalt
  const r2 = await page.request.get(link);
  expect(r2.status()).toBe(401);
});

test('magic link verloopt na 15 minuten', async ({ page }) => {
  // Vereist test-mode waarin je tijd kunt mocken, of fixture met expired token
  // Skip als geen tijd-mock beschikbaar
});
```

### Hoe in CI

Deze tests draaien in `playwright.yml` met de bestaande dev-server + Postgres service. Voeg toe als label `auth-security` om selectief te draaien tijdens auth-changes.

---

## 2. Autorisatie (RBAC + tenant isolatie)

### Wat test je en waarom

Dit is BOM's #1 risico. Eén ontbrekend `tenant_id` filter = data leak tussen tenants. Eén ontbrekende `canDo()` = privilege escalation.

### Unit tests — `src/lib/permissions.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { canDo } from './permissions';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('canDo — RBAC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin met assistants.create → true', async () => {
    mockPermissionLookup({ role: 'admin', permissions: ['assistants.create'] });
    expect(await canDo('user-1', 'tenant-1', 'assistants', 'create')).toBe(true);
  });

  it('member zonder assistants.create → false', async () => {
    mockPermissionLookup({ role: 'member', permissions: ['assistants.read'] });
    expect(await canDo('user-1', 'tenant-1', 'assistants', 'create')).toBe(false);
  });

  it('user die geen lid is van tenant → false', async () => {
    mockPermissionLookup({ role: null, permissions: [] });
    expect(await canDo('user-1', 'tenant-onbekend', 'assistants', 'read')).toBe(false);
  });

  it('admin van tenant A vraagt rechten in tenant B → false', async () => {
    // Belangrijke test: admin-rol is per tenant, niet globaal
    mockPermissionLookup({ role: null, permissions: [] }); // niet lid van tenant-B
    expect(await canDo('admin-tenant-a', 'tenant-b', 'assistants', 'create')).toBe(false);
  });

  it('niet-bestaande permissie → false (geen crash)', async () => {
    mockPermissionLookup({ role: 'admin', permissions: ['assistants.create'] });
    // @ts-expect-error - testen runtime gedrag
    expect(await canDo('user-1', 'tenant-1', 'fake', 'action')).toBe(false);
  });

  it('SQL-injectie in resource/action → false (Drizzle parameterized)', async () => {
    mockPermissionLookup({ role: 'admin', permissions: [] });
    expect(await canDo('user-1', 'tenant-1', "'; DROP TABLE users--", 'read')).toBe(false);
    // Verifieer dat users-tabel nog bestaat
  });
});

function mockPermissionLookup(opts: { role: string | null; permissions: string[] }) {
  // Mock de Drizzle select-chain. Pas aan naar je werkelijke implementatie.
}
```

### E2E tests — `e2e/tenant-isolation.spec.ts`

**Dit is de belangrijkste test in BOM.**

```typescript
import { test, expect } from '@playwright/test';
import { createTestTenant, createTestUser, cleanupTestData } from '../src/__tests__/fixtures/users';
import { loginAs } from './helpers/auth';

test.describe('Multi-tenant isolatie', () => {
  let tenantA: string;
  let tenantB: string;
  let adminA: Awaited<ReturnType<typeof createTestUser>>;
  let adminB: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    tenantA = await createTestTenant('Tenant A');
    tenantB = await createTestTenant('Tenant B');
    adminA = await createTestUser({ tenantId: tenantA, role: 'admin' });
    adminB = await createTestUser({ tenantId: tenantB, role: 'admin' });

    // Maak test-data in beide tenants
    await seedAssistants(tenantA, ['assistant-A1', 'assistant-A2']);
    await seedAssistants(tenantB, ['assistant-B1']);
  });

  test.afterAll(async () => {
    await cleanupTestData(tenantA);
    await cleanupTestData(tenantB);
  });

  test('admin A ziet alleen eigen assistants', async ({ context, page }) => {
    await loginAs(context, adminA);
    const response = await page.request.get('/api/assistants');
    const assistants = await response.json();
    const ids = assistants.map((a: { id: string }) => a.id);
    expect(ids).toContain('assistant-A1');
    expect(ids).toContain('assistant-A2');
    expect(ids).not.toContain('assistant-B1');
  });

  test('admin A krijgt 403 of 404 bij directe GET op assistant van tenant B', async ({ context, page }) => {
    await loginAs(context, adminA);
    const response = await page.request.get('/api/assistants/assistant-B1');
    // 404 is beter dan 403 (verbergt het bestaan)
    expect([403, 404]).toContain(response.status());
  });

  test('admin A kan assistant van tenant B niet wijzigen', async ({ context, page }) => {
    await loginAs(context, adminA);
    const response = await page.request.patch('/api/assistants/assistant-B1', {
      data: { name: 'gehackt' },
    });
    expect([403, 404]).toContain(response.status());
  });

  test('admin A kan assistant van tenant B niet verwijderen', async ({ context, page }) => {
    await loginAs(context, adminA);
    const response = await page.request.delete('/api/assistants/assistant-B1');
    expect([403, 404]).toContain(response.status());
  });

  test('manipulatie van tenantId in request body wordt genegeerd', async ({ context, page }) => {
    await loginAs(context, adminA);
    // Probeer assistant te maken in tenant B via injected tenantId
    const response = await page.request.post('/api/assistants', {
      data: {
        name: 'cross-tenant create poging',
        tenantId: tenantB, // moet genegeerd worden
      },
    });
    if (response.status() === 201) {
      const created = await response.json();
      // Server moet sessie-tenant gebruiken, niet body
      expect(created.tenantId).toBe(tenantA);
    }
  });
});

test.describe('RBAC — member kan geen schrijfacties', () => {
  let tenantId: string;
  let member: Awaited<ReturnType<typeof createTestUser>>;

  test.beforeAll(async () => {
    tenantId = await createTestTenant('RBAC Test');
    member = await createTestUser({ tenantId, role: 'member' });
  });

  const writeEndpoints: Array<[string, string, unknown]> = [
    ['POST', '/api/assistants', { name: 'test' }],
    ['PATCH', '/api/assistants/some-id', { name: 'updated' }],
    ['DELETE', '/api/assistants/some-id', null],
    ['POST', '/api/webhooks/tokens', { name: 'token' }],
    ['DELETE', '/api/webhooks/tokens/some-id', null],
    ['POST', '/api/assistant-runs', { assistantId: 'some-id' }],
  ];

  for (const [method, url, body] of writeEndpoints) {
    test(`member krijgt 403 op ${method} ${url}`, async ({ context, page }) => {
      await loginAs(context, member);
      const response = await page.request.fetch(url, {
        method,
        data: body ?? undefined,
      });
      expect(response.status()).toBe(403);
    });
  }
});
```

---

## 3. Webhook security

### Wat test je en waarom

Webhooks zijn extern bereikbaar zonder gebruikerssessie — bearer token is je enige verdediging. Eén bug = data injectie van willekeurige attacker.

### Integration tests — `src/__tests__/integration/webhooks.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db';
import { webhookTokens } from '@/db/schema/app';
import { encrypt } from '@/lib/crypto';
import { POST as inboundHandler } from '@/app/api/webhooks/inbound/route';

describe('Webhook inbound — bearer auth', () => {
  let validToken: string;
  let revokedToken: string;
  let tenantId: string;

  beforeAll(async () => {
    tenantId = 'tenant-webhook-test';
    validToken = 'whk_' + crypto.randomUUID();
    revokedToken = 'whk_' + crypto.randomUUID();

    await db.insert(webhookTokens).values([
      {
        id: 'token-valid',
        tenantId,
        tokenEncrypted: encrypt(validToken),
        revokedAt: null,
      },
      {
        id: 'token-revoked',
        tenantId,
        tokenEncrypted: encrypt(revokedToken),
        revokedAt: new Date(),
      },
    ]);
  });

  it('zonder Authorization header → 401', async () => {
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
    });
    const response = await inboundHandler(req);
    expect(response.status).toBe(401);
  });

  it('met fout bearer token → 401', async () => {
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      headers: { Authorization: 'Bearer fout-token' },
      body: JSON.stringify({ event: 'test' }),
    });
    const response = await inboundHandler(req);
    expect(response.status).toBe(401);
  });

  it('met geldig token → 200/202', async () => {
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: JSON.stringify({ event: 'test' }),
    });
    const response = await inboundHandler(req);
    expect([200, 202]).toContain(response.status);
  });

  it('met ingetrokken token → 401', async () => {
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      headers: { Authorization: `Bearer ${revokedToken}` },
      body: JSON.stringify({ event: 'test' }),
    });
    const response = await inboundHandler(req);
    expect(response.status).toBe(401);
  });

  it('payload > 1 MB → 413 (DoS-bescherming)', async () => {
    const huge = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: huge,
    });
    const response = await inboundHandler(req);
    expect(response.status).toBe(413);
  });

  it('malformed JSON → 400 zonder stack trace', async () => {
    const req = new Request('https://test/api/webhooks/inbound', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: '{invalid json',
    });
    const response = await inboundHandler(req);
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).not.toContain('at '); // geen stack trace
    expect(body).not.toContain('SyntaxError');
  });

  it('webhook token in DB is encrypted (niet plaintext leesbaar)', async () => {
    const rows = await db.select().from(webhookTokens).where(/*...*/);
    for (const row of rows) {
      expect(row.tokenEncrypted).not.toContain('whk_');
      expect(row.tokenEncrypted.length).toBeGreaterThan(60); // encrypted blob
    }
  });
});
```

---

## 4. Crypto (`src/lib/crypto.ts`)

### Wat test je en waarom

AES-256-GCM zonder auth-tag verificatie is geen security, alleen obfuscation. Test of tampering daadwerkelijk faalt.

### Unit tests — `src/lib/crypto.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('crypto — AES-256-GCM', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4); // 64 hex chars
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('roundtrip: encrypt → decrypt → origineel', () => {
    const plaintext = 'whk_super_secret_token';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('elke encrypt-call produceert ander resultaat (random IV)', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 100; i++) samples.add(encrypt('zelfde-input'));
    expect(samples.size).toBe(100); // alle 100 uniek
  });

  it('tampering met ciphertext → throws', () => {
    const encrypted = encrypt('origineel');
    const middle = Math.floor(encrypted.length / 2);
    const tampered = encrypted.slice(0, middle) + 'XX' + encrypted.slice(middle + 2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it('tampering met auth-tag → throws (GCM integrity check)', () => {
    const encrypted = encrypt('origineel');
    // Auth-tag zit meestal aan het einde — flip laatste karakter
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith('=') ? 'X' : '=');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('decrypt met andere key → throws (key rotation simulatie)', () => {
    const encrypted = encrypt('origineel');
    process.env.ENCRYPTION_KEY = 'fedcba9876543210'.repeat(4);
    expect(() => decrypt(encrypted)).toThrow();
    process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4); // restore
  });

  it('faalt bij ontbrekende ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('foo')).toThrow();
    process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  it('faalt bij key met verkeerde lengte', () => {
    process.env.ENCRYPTION_KEY = 'te-kort';
    expect(() => encrypt('foo')).toThrow();
    process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  it('performance: < 5ms per encrypt-call (webhook hot path)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) encrypt('test-token');
    const avgMs = (performance.now() - start) / 1000;
    expect(avgMs).toBeLessThan(5);
  });
});
```

---

## 5. Input validatie & injectie

### Wat test je en waarom

OpenCode genereert vaak Zod-schemas die te tolerant zijn (bv. `.optional()` waar het verplicht hoort). Test elke schrijfroute expliciet.

### Tests — `src/__tests__/integration/api-validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

const adminAuth = { Cookie: `better-auth.session_token=${adminSessionToken}` };

describe('Input validatie — POST /api/assistants', () => {
  it('lege body → 400', async () => {
    const res = await fetch('/api/assistants', { method: 'POST', headers: adminAuth });
    expect(res.status).toBe(400);
  });

  it('ontbrekende verplichte velden → 400 met details', async () => {
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  it('extra velden worden geweigerd of gestript (Zod strict)', async () => {
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'valid',
        tenantId: 'attacker-controlled', // moet genegeerd
        isAdmin: true, // moet genegeerd
      }),
    });
    if (res.status === 201) {
      const created = await res.json();
      expect(created.isAdmin).toBeUndefined();
      expect(created.tenantId).not.toBe('attacker-controlled');
    }
  });

  it('SQL-injectie in string-veld → opgeslagen als string, geen DB-impact', async () => {
    const payload = "'; DROP TABLE app.assistants; --";
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: payload }),
    });
    expect([201, 400]).toContain(res.status);
    // Verifieer dat tabel nog bestaat
    const list = await fetch('/api/assistants', { headers: adminAuth });
    expect(list.status).toBe(200);
  });

  it('XSS-payload in name blijft escaped in response', async () => {
    const xss = '<script>alert(1)</script>';
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: xss }),
    });
    if (res.status === 201) {
      const created = await res.json();
      // Server moet niet pre-escapen — frontend doet dat. Maar response moet wel JSON-safe zijn
      expect(created.name).toBe(xss);
    }
  });

  it('oversized payload (>1MB) → 413', async () => {
    const huge = 'x'.repeat(2 * 1024 * 1024);
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: huge }),
    });
    expect(res.status).toBe(413);
  });

  it('malformed JSON → 400 zonder stack trace', async () => {
    const res = await fetch('/api/assistants', {
      method: 'POST',
      headers: { ...adminAuth, 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toMatch(/at .*\.ts:\d+/); // geen stack trace
  });
});
```

---

## 6. Headers & transport security

### Tests — `e2e/security-headers.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('productie headers — CSP, HSTS, X-Frame-Options, nosniff', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL?.startsWith('https'), 'Alleen tegen HTTPS productie');

  const response = await page.request.get('/');
  const headers = response.headers();

  expect(headers['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
  expect(headers).toHaveProperty('content-security-policy');
  // Permissions-Policy is nice-to-have
  // Referrer-Policy zou no-referrer of strict-origin moeten zijn
  expect(headers['referrer-policy']).toMatch(/no-referrer|strict-origin/);
});

test('API responses bevatten geen Server-header met versie', async ({ page }) => {
  const response = await page.request.get('/api/health');
  const headers = response.headers();
  expect(headers['server']).not.toMatch(/Next\.js\/\d/);
  expect(headers['x-powered-by']).toBeUndefined();
});
```

### Configuratie — `next.config.ts`

Tests forceren je om dit te configureren:

```typescript
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
  },
];

export default {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

---

## 7. Rate limiting

### Tests — `e2e/rate-limiting.spec.ts`

```typescript
test('login endpoint — 5 fouten per minuut → 429', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.request.post('/api/auth/sign-in/email', {
      data: { email: 'test@example.com', password: 'fout' },
    });
  }
  const blocked = await page.request.post('/api/auth/sign-in/email', {
    data: { email: 'test@example.com', password: 'fout' },
  });
  expect(blocked.status()).toBe(429);
  expect(blocked.headers()['retry-after']).toBeDefined();
});

test('webhook inbound — 100 req/min → 429', async ({ page }) => {
  // Skip als geen rate limit ingesteld op webhooks
  // Dit is een design-keuze die je expliciet moet maken
});
```

**Note:** Better Auth heeft optionele rate limiting. Activeer expliciet in `auth.ts` config en test of het werkt.

---

## 8. Geautomatiseerde security tools

Geen handgeschreven tests, maar configuratie. Zorg dat deze in CI draaien:

### `.github/workflows/zap-baseline.yml` (wekelijks)

```yaml
name: OWASP ZAP baseline scan
on:
  schedule:
    - cron: '0 4 * * 1'  # maandag 04:00
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
```

### `.github/workflows/semgrep.yml` aanpassen voor OWASP ruleset

```yaml
- run: semgrep ci --config=p/owasp-top-ten --config=p/typescript --config=p/nextjs
```

### `npm audit` in CI

Voeg toe aan `checks.yml`:

```yaml
- name: npm audit
  run: npm audit --audit-level=high
```

---

## 9. Regressie-discipline

### Werkwijze (geen tools)

Voor elke productiebug, in deze volgorde:

1. **Reproduceer** lokaal (kopieer Sentry/GlitchTip event data)
2. **Schrijf een falende test** die de bug demonstreert
3. **Fix de code** tot de test groen wordt
4. **Merge** met test inbegrepen

Eenvoudige test-conventie:

```typescript
// REGRESSION: GH-142 — webhook token zonder revokedAt-check werd geaccepteerd na revoke
it('REGRESSION GH-142: ingetrokken token wordt direct geweigerd', async () => {
  // ...
});
```

### Map-structuur

```
src/__tests__/
  fixtures/         — gedeelde test-data
  unit/             — pure logic tests
  integration/      — DB-touchende tests
  regressions/      — bug-regression tests met issue/Sentry-link
e2e/
  *.spec.ts         — gebruiker-flows
  security/         — security-specifieke E2E
  helpers/          — Playwright helpers
```

### Ritueel

- **Bij elke Sentry/GlitchTip event** met severity `error` of hoger: ticket → reproduce → test → fix
- **Kwartaalreview**: zoek naar `// SKIP` of `.skip(` in tests. Skipped regression-tests = open bug die terug kan komen
- **Ticket-template** sluit met: "Regression test geschreven? Bestand:"

---

## Test-coverage targets per laag

| Laag | Minimum | Doel | Notitie |
|------|---------|------|---------|
| `src/lib/crypto.ts` | 100% | 100% | Geen excuses, kritieke code |
| `src/lib/permissions.ts` | 95% | 100% | RBAC bypass = game over |
| `src/lib/auth.ts` | 80% | 90% | Better Auth doet zelf veel, jouw config testen |
| `src/app/api/**` | 70% | 85% | Elke route minstens happy + 1 fail-path + 1 auth-test |
| `src/db/schema/**` | n.v.t. | n.v.t. | Geen logic, alleen types |
| `src/components/**` | 50% | 70% | UI is minder kritiek dan API |

---

## Prioriteit voor BOM (waar te beginnen)

Als je vandaag start, in deze volgorde:

1. **`crypto.test.ts`** — 30 min, dekt het #1 risico
2. **`permissions.test.ts` (unit)** — 60 min, dekt het #2 risico
3. **`tenant-isolation.spec.ts` (E2E)** — 90 min, dekt het #3 risico
4. **`auth-security.spec.ts` (E2E)** — 60 min, dekt sessie/login risks
5. **`api-validation.test.ts` (integration)** — 60 min per API route
6. **`security-headers.spec.ts`** — 15 min, forceert headers config
7. **Webhook integration tests** — 90 min, kritiek voor inbound security
8. **Rate limiting tests** — 30 min, lage prioriteit maar nuttig

**Totaal eerste sweep: ~6-7 uur** verspreid over 2-3 dagen.

---

## Wanneer dit playbook bijwerken

- Nieuwe API-route toegevoegd → voeg validatie + auth + RBAC test toe
- Nieuw schema in `db/schema/` → voeg tenant-isolatie test toe als het een tenant-resource is
- Nieuwe rol of permissie → breid `permissions.test.ts` uit
- Productiebug gevonden → voeg regression test toe in `src/__tests__/regressions/`
- Sentry/GlitchTip toont patroon → onderzoek of bredere test mogelijk is

Dit document leeft mee met de codebase. Verouderd playbook = vals gevoel van veiligheid.

# Design: BackOffice AI Platform

**Datum:** 2026-04-10  
**Status:** Goedgekeurd (spec aangeleverd door gebruiker)

---

## 1. Doel

Een productie-klaar back-office AI-automatiseringsplatform voor MKB-klanten. Multi-tenant SaaS waarbij elke tenant AI-assistenten beheert, review-items verwerkt en integraties configureert. Operatoren zien één dashboard met real-time metrics, activiteit en open taken.

---

## 2. Tech Stack

| Laag | Keuze |
|------|-------|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| Styling | Tailwind CSS v4 + CSS variabelen voor merktkleuren |
| Database ORM | Drizzle ORM + postgres driver |
| Auth | Better Auth (email/password + magic link) |
| UI Components | shadcn/ui (slate theme) |
| Icons | Lucide React |
| Formulieren | React Hook Form + Zod |
| Client state | Zustand |
| Server state | React Query (TanStack Query v5) |
| Deploy | Docker via Coolify |

---

## 3. Kleurstelling

```css
--sidebar-bg:   #0F1729;  /* donker marineblauw */
--primary:      #3B82F6;  /* electric blue */
--canvas:       #F8FAFC;  /* licht grijs */
--success:      #22C55E;
--error:        #EF4444;
--warning:      #F59E0B;
```

---

## 4. Database Schema (Drizzle + PostgreSQL)

### Tabellen

**users** — id, email, name, role (admin|member), created_at  
**tenants** — id, name, slug, plan, created_at  
**tenant_users** — tenant_id, user_id, role  
**assistants** — id, tenant_id, name, description, type, status (active|paused|error), config (jsonb), created_at, updated_at  
**assistant_runs** — id, assistant_id, status, input (jsonb), output (jsonb), duration_ms, created_at  
**review_items** — id, assistant_id, tenant_id, title, description, priority (low|medium|high|critical), status (open|approved|rejected|ignored), metadata (jsonb), created_at, resolved_at, resolved_by  
**integrations** — id, tenant_id, type (exact|ms365|slack|ubl|custom), status (active|error|setup), config (jsonb), last_checked_at  

### Multi-tenant isolatie
Elke query filtert op `tenant_id`. Nooit cross-tenant data.

### Toekomstige RAG
`pgvector` extensie als comment gereserveerd in schema.

---

## 5. Authenticatie

- Better Auth met email/password + magic link
- Session opgeslagen in httpOnly cookie
- Next.js middleware beschermt alle routes onder `/(dashboard)/`
- Na succesvolle login: redirect naar `/`
- Auth handler: `src/app/api/auth/[...all]/route.ts`

---

## 6. Applicatiestructuur

### Routes

| Route | Functie |
|-------|---------|
| `/login` | E-mail/wachtwoord + magic link form |
| `/register` | Registratiepagina |
| `/` | Dashboard met metrics + live-indicator |
| `/assistants` | Overzicht alle assistenten |
| `/assistants/[id]` | Assistent detail + configuratie |
| `/inbox` | Review-inbox |
| `/integrations` | Integratiebeheer |
| `/settings` | Instellingen |

### API Routes

| Endpoint | Methode | Functie |
|----------|---------|---------|
| `/api/auth/[...all]` | ALL | Better Auth handler |
| `/api/dashboard/metrics` | GET | Metric cards |
| `/api/assistants` | GET, POST | Assistentenlijst |
| `/api/assistants/[id]` | GET, PATCH, DELETE | Assistent detail + toggle |
| `/api/review` | GET, POST | Review items |
| `/api/review/[id]` | PATCH | Review item status updaten |

---

## 7. Dashboard Ontwerp

### Metric Cards (4x)
1. Taken vandaag
2. Tijd bespaard (minuten)
3. Actieve assistenten (x/y)
4. Open review-items

Data via `GET /api/dashboard/metrics`, gerefresht elke 30 seconden via React Query.

### Topbar
- Live-indicator: pulserende groene dot (status van platform)
- Tenant-naam + gebruikersmenu

### Assistent-lijst (links/midden)
- Status dot: groen (active), oranje (paused), rood (error), grijs (onbekend)
- Naam, omschrijving, dagelijkse run-teller
- Toggle aan/uit → `PATCH /api/assistants/[id]` met `{ status }`

### Review-inbox paneel (rechts)
- Max 5 open items, gesorteerd op priority (critical → high → medium → low)
- Per item: prioriteitstag (kleurgecodeerd), titel, beschrijving
- Knoppen: Goedkeuren → `PATCH /api/review/[id] { status: 'approved' }`, Afwijzen → `rejected`
- Link "Bekijk" → `/inbox`

---

## 8. Sidebar Navigatie

```
Overzicht
  • Dashboard
  • Activiteit

Assistenten
  • Alle assistenten
  • Review-inbox  [badge: open items]

Beheer
  • Klanten
  • Instellingen
```

Actieve staat: `#3B82F6` achtergrond + 3px left border.  
Mobiel: collapst naar icon-only (geen labels).

---

## 9. Kwaliteitseisen

- TypeScript `strict: true`, geen `any`
- Alle API routes: Zod-validatie op input, juiste HTTP statuscodes
- Drizzle queries: altijd `tenant_id` filter
- Geen hardcoded strings: enums/constants in `src/types/index.ts`
- Tailwind theme-extensie via `tailwind.config.ts` voor merktkleuren
- Responsive sidebar (icon-only op mobiel)

---

## 10. Docker / Deploy

### Dockerfile (multi-stage)
1. **builder** — installeert deps, bouwt Next.js
2. **runner** — non-root user, kopieert build artifacts

### Entrypoint
Voert `drizzle-kit migrate` uit vóór `node server.js` zodat DB-migraties automatisch draaien bij deployment via Coolify.

### docker-compose.yml (lokaal)
- `app` service (Next.js)
- `postgres` service (PostgreSQL 16)

---

## 11. Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 12. Implementatievolgorde

1. Next.js init + dependencies installeren
2. Drizzle schema + eerste migratie
3. Tailwind config + shadcn/ui setup
4. Layout shell (sidebar + topbar)
5. Dashboard pagina (mock → echte API)
6. API routes
7. Better Auth + middleware
8. Auth pagina's
9. Docker setup
10. .env.example + .gitignore + projectstructuur

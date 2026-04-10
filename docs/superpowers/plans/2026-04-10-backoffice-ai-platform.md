# BackOffice AI Platform — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een productie-klaar multi-tenant back-office AI-automatiseringsplatform als Next.js 15 applicatie met sidebar, dashboard, assistentenbeheer en review-inbox.

**Architecture:** App Router met route groups voor auth `(auth)` en dashboard `(dashboard)`. Drizzle ORM spreekt PostgreSQL aan via server-side code; alle queries filteren op `tenant_id`. Better Auth beheert sessies via httpOnly cookies. React Query haalt server state op; Zustand beheert client state.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS v4, Drizzle ORM + postgres, Better Auth, shadcn/ui (slate), React Query v5, Zustand, React Hook Form + Zod, Lucide React, Docker

---

## Bestandskaart

```
src/
  types/index.ts                    — enums, gedeelde types
  db/
    index.ts                        — Drizzle client
    schema.ts                       — alle tabeldefinities
  lib/
    auth.ts                         — Better Auth configuratie
    validations.ts                  — Zod schemas voor API input
  app/
    globals.css                     — Tailwind v4 @theme merktkleuren
    layout.tsx                      — root layout (ReactQueryProvider, fonts)
    (auth)/
      login/page.tsx                — login form
      register/page.tsx             — registratie form
    (dashboard)/
      layout.tsx                    — sidebar + topbar shell
      page.tsx                      — dashboard
      assistants/
        page.tsx                    — assistent overzicht
        [id]/page.tsx               — assistent detail
      inbox/page.tsx                — review-inbox
      integrations/page.tsx         — integraties
      settings/page.tsx             — instellingen
    api/
      auth/[...all]/route.ts        — Better Auth handler
      dashboard/metrics/route.ts    — GET metrics
      assistants/route.ts           — GET lijst / POST nieuw
      assistants/[id]/route.ts      — GET detail / PATCH / DELETE
      review/route.ts               — GET items
      review/[id]/route.ts          — PATCH status
  components/
    layout/
      sidebar.tsx                   — navigatie + collapse op mobiel
      topbar.tsx                    — live-indicator + gebruikersmenu
    dashboard/
      metrics-grid.tsx              — 4 stat cards
      assistant-row.tsx             — rij in assistentenlijst
      review-item.tsx               — kaart in review paneel
    providers/
      query-provider.tsx            — ReactQueryClientProvider wrapper
middleware.ts                       — route bescherming
drizzle.config.ts                   — Drizzle Kit configuratie
.env.example
.env.local
.gitignore
Dockerfile
docker-compose.yml
.dockerignore
```

---

## Task 1: Project initialiseren

**Files:**
- Create: `.gitignore`
- Modify: `package.json` (dependencies)
- Create: `.env.example`, `.env.local`

- [ ] **Stap 1.1: Next.js project aanmaken**

```bash
cd "c:/Users/jaap/stack/8. Claude Code/6 BOM/BOM"
npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-git --yes
```

Verwacht: project bestanden aangemaakt, `package.json` aanwezig.

- [ ] **Stap 1.2: Extra dependencies installeren**

```bash
npm install drizzle-orm postgres
npm install drizzle-kit --save-dev
npm install better-auth
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install lucide-react
npm install @types/pg --save-dev
```

- [ ] **Stap 1.3: shadcn/ui initialiseren**

```bash
npx shadcn@latest init --defaults --yes
```

Kies als gevraagd: slate base color, src/components/ui.

- [ ] **Stap 1.4: shadcn componenten installeren**

```bash
npx shadcn@latest add button card badge input label dialog dropdown-menu separator avatar sheet scroll-area tooltip
```

- [ ] **Stap 1.5: .env.example aanmaken**

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
BETTER_AUTH_SECRET=vervang_dit_met_random_32_char_string
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Stap 1.6: .env.local aanmaken (lokaal, niet in git)**

```env
DATABASE_URL=postgresql://bom:bom@localhost:5432/bom
BETTER_AUTH_SECRET=dev_secret_32_chars_minimum_here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Stap 1.7: .gitignore controleren / aanvullen**

Zorg dat `.env.local` en `.claude/settings.local.json` erin staan:

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# env files
.env
.env*.local
!.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# local claude
.claude/settings.local.json
CLAUDE.local.md
```

- [ ] **Stap 1.8: tsconfig.json — strict mode bevestigen**

Controleer dat `tsconfig.json` bevat:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Stap 1.9: Commit**

```bash
git add -A
git commit -m "chore: initialiseer Next.js 15 project met dependencies"
```

---

## Task 2: Types en enums

**Files:**
- Create: `src/types/index.ts`

- [ ] **Stap 2.1: Maak src/types/index.ts aan**

```typescript
// src/types/index.ts

export const UserRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const TenantPlan = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan]

export const AssistantStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
} as const
export type AssistantStatus = (typeof AssistantStatus)[keyof typeof AssistantStatus]

export const ReviewPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const
export type ReviewPriority = (typeof ReviewPriority)[keyof typeof ReviewPriority]

export const ReviewStatus = {
  OPEN: 'open',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IGNORED: 'ignored',
} as const
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const IntegrationType = {
  EXACT: 'exact',
  MS365: 'ms365',
  SLACK: 'slack',
  UBL: 'ubl',
  CUSTOM: 'custom',
} as const
export type IntegrationType = (typeof IntegrationType)[keyof typeof IntegrationType]

export const IntegrationStatus = {
  ACTIVE: 'active',
  ERROR: 'error',
  SETUP: 'setup',
} as const
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus]

export const RunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus]

// API response types
export interface ApiError {
  error: string
  code?: string
}

export interface DashboardMetrics {
  tasksToday: number
  timeSavedMinutes: number
  activeAssistants: number
  totalAssistants: number
  openReviewItems: number
}
```

- [ ] **Stap 2.2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: voeg types en enums toe"
```

---

## Task 3: Database schema en Drizzle configuratie

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`

- [ ] **Stap 3.1: Maak src/db/schema.ts aan**

```typescript
// src/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core'
import {
  UserRole,
  TenantPlan,
  AssistantStatus,
  ReviewPriority,
  ReviewStatus,
  IntegrationType,
  IntegrationStatus,
  RunStatus,
} from '@/types'

// pgvector extensie voor toekomstige RAG:
// CREATE EXTENSION IF NOT EXISTS vector;

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').$type<UserRole>().notNull().default(UserRole.MEMBER),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').$type<TenantPlan>().notNull().default(TenantPlan.FREE),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const tenantUsers = pgTable('tenant_users', {
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<UserRole>().notNull().default(UserRole.MEMBER),
})

export const assistants = pgTable('assistants', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull(),
  status: text('status').$type<AssistantStatus>().notNull().default(AssistantStatus.PAUSED),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const assistantRuns = pgTable('assistant_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  status: text('status').$type<RunStatus>().notNull(),
  input: jsonb('input').notNull().default({}),
  output: jsonb('output').notNull().default({}),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const reviewItems = pgTable('review_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').$type<ReviewPriority>().notNull().default(ReviewPriority.MEDIUM),
  status: text('status').$type<ReviewStatus>().notNull().default(ReviewStatus.OPEN),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
})

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').$type<IntegrationType>().notNull(),
  status: text('status').$type<IntegrationStatus>().notNull().default(IntegrationStatus.SETUP),
  config: jsonb('config').notNull().default({}),
  lastCheckedAt: timestamp('last_checked_at'),
})

// Better Auth vereist deze tabellen:
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const verifications = pgTable('verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

- [ ] **Stap 3.2: Maak src/db/index.ts aan**

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) {
  throw new Error('DATABASE_URL omgevingsvariabele is niet ingesteld')
}

const client = postgres(connectionString)
export const db = drizzle(client, { schema })
```

- [ ] **Stap 3.3: Maak drizzle.config.ts aan**

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
} satisfies Config
```

- [ ] **Stap 3.4: Genereer eerste migratie (vereist database)**

```bash
npx drizzle-kit generate
```

Verwacht: `src/db/migrations/0000_*.sql` aangemaakt.

- [ ] **Stap 3.5: Commit**

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: voeg Drizzle schema en configuratie toe"
```

---

## Task 4: Tailwind merktkleuren + globals.css

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts` (indien aanwezig)

- [ ] **Stap 4.1: Overschrijf src/app/globals.css**

```css
@import "tailwindcss";

@theme {
  --color-sidebar-bg: #0F1729;
  --color-primary: #3B82F6;
  --color-canvas: #F8FAFC;
  --color-success: #22C55E;
  --color-app-error: #EF4444;
  --color-warning: #F59E0B;

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-canvas text-slate-900 antialiased;
  }
}
```

- [ ] **Stap 4.2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: voeg merktkleuren toe via Tailwind v4 @theme"
```

---

## Task 5: Better Auth configuratie

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `middleware.ts`

- [ ] **Stap 5.1: Maak src/lib/auth.ts aan**

```typescript
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { db } from '@/db'
import { users, sessions, accounts, verifications } from '@/db/schema'

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
      sendMagicLink: async ({ email, url }) => {
        // In productie: vervang door echte e-mail provider
        console.log(`[Magic Link] ${email}: ${url}`)
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minuten
    },
  },
})

export type Session = typeof auth.$Infer.Session
```

- [ ] **Stap 5.2: Maak API auth handler aan**

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Stap 5.3: Maak middleware.ts aan**

```typescript
// middleware.ts (root van project, naast src/)
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PATHS = ['/assistants', '/inbox', '/integrations', '/settings']
const AUTH_PATHS = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ??
    request.cookies.get('__Secure-better-auth.session_token')?.value

  const isProtected =
    pathname === '/' || PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPath && sessionToken) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Stap 5.4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ middleware.ts
git commit -m "feat: Better Auth configuratie + middleware route bescherming"
```

---

## Task 6: Zod validaties + query provider

**Files:**
- Create: `src/lib/validations.ts`
- Create: `src/components/providers/query-provider.tsx`

- [ ] **Stap 6.1: Maak src/lib/validations.ts aan**

```typescript
// src/lib/validations.ts
import { z } from 'zod'
import { ReviewStatus, AssistantStatus } from '@/types'

export const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().min(2, 'Naam minimaal 2 tekens'),
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const updateAssistantStatusSchema = z.object({
  status: z.enum([
    AssistantStatus.ACTIVE,
    AssistantStatus.PAUSED,
    AssistantStatus.ERROR,
  ]),
})
export type UpdateAssistantStatusInput = z.infer<typeof updateAssistantStatusSchema>

export const updateReviewStatusSchema = z.object({
  status: z.enum([
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
    ReviewStatus.IGNORED,
  ]),
})
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>
```

- [ ] **Stap 6.2: Maak query provider aan**

```typescript
// src/components/providers/query-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconden
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

- [ ] **Stap 6.3: Update root layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { QueryProvider } from '@/components/providers/query-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BackOffice AI Platform',
  description: 'AI automatisering voor jouw organisatie',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

- [ ] **Stap 6.4: Commit**

```bash
git add src/lib/validations.ts src/components/providers/ src/app/layout.tsx
git commit -m "feat: Zod validaties, query provider en root layout"
```

---

## Task 7: Sidebar component

**Files:**
- Create: `src/components/layout/sidebar.tsx`

- [ ] **Stap 7.1: Maak sidebar.tsx aan**

```typescript
// src/components/layout/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  Bot,
  Inbox,
  Users,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  openReviewCount?: number
}

const getNavSections = (openReviewCount: number): NavSection[] => [
  {
    title: 'Overzicht',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/activity', label: 'Activiteit', icon: Activity },
    ],
  },
  {
    title: 'Assistenten',
    items: [
      { href: '/assistants', label: 'Alle assistenten', icon: Bot },
      {
        href: '/inbox',
        label: 'Review-inbox',
        icon: Inbox,
        badge: openReviewCount > 0 ? openReviewCount : undefined,
      },
    ],
  },
  {
    title: 'Beheer',
    items: [
      { href: '/customers', label: 'Klanten', icon: Users },
      { href: '/settings', label: 'Instellingen', icon: Settings },
    ],
  },
]

export function Sidebar({ openReviewCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const sections = getNavSections(openReviewCount)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex h-screen w-16 flex-col md:w-60 shrink-0 border-r border-slate-800"
        style={{ backgroundColor: '#0F1729' }}>
        {/* Logo */}
        <div className="flex h-16 items-center px-4 border-b border-slate-800">
          <Zap className="h-6 w-6 text-primary shrink-0" />
          <span className="ml-3 hidden md:block text-white font-semibold text-sm tracking-wide">
            BackOffice AI
          </span>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="hidden md:block px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  return (
                    <li key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors relative',
                              active
                                ? 'bg-primary/20 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            )}
                            style={
                              active
                                ? {
                                    borderLeft: '3px solid #3B82F6',
                                    paddingLeft: '9px',
                                  }
                                : {}
                            }
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="hidden md:block">{item.label}</span>
                            {item.badge !== undefined && (
                              <Badge
                                className="ml-auto hidden md:flex h-5 min-w-5 items-center justify-center bg-primary text-white text-xs"
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="md:hidden">
                          {item.label}
                          {item.badge !== undefined && ` (${item.badge})`}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
```

- [ ] **Stap 7.2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: sidebar navigatie met collapse op mobiel"
```

---

## Task 8: Topbar component

**Files:**
- Create: `src/components/layout/topbar.tsx`

- [ ] **Stap 8.1: Maak topbar.tsx aan**

```typescript
// src/components/layout/topbar.tsx
'use client'

import { Bell, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TopbarProps {
  userName?: string
  tenantName?: string
}

export function Topbar({
  userName = 'Gebruiker',
  tenantName = 'Mijn organisatie',
}: TopbarProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Links: tenant naam */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{tenantName}</span>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 ml-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-slate-500">Live</span>
        </div>
      </div>

      {/* Rechts: notificaties + gebruikersmenu */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-slate-500">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm text-slate-700">{userName}</span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <a href="/settings">Instellingen</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => {
                fetch('/api/auth/sign-out', { method: 'POST' }).then(() => {
                  window.location.href = '/login'
                })
              }}
            >
              Uitloggen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

- [ ] **Stap 8.2: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: topbar met live-indicator en gebruikersmenu"
```

---

## Task 9: Dashboard layout shell

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`

- [ ] **Stap 9.1: Maak dashboard layout aan**

```typescript
// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar openReviewCount={3} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName="Jaap Hoeve" tenantName="Demo Organisatie" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Stap 9.2: Commit**

```bash
git add src/app/'(dashboard)'/layout.tsx
git commit -m "feat: dashboard layout shell met sidebar en topbar"
```

---

## Task 10: Dashboard metric cards component

**Files:**
- Create: `src/components/dashboard/metrics-grid.tsx`

- [ ] **Stap 10.1: Maak metrics-grid.tsx aan**

```typescript
// src/components/dashboard/metrics-grid.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, Bot, AlertTriangle } from 'lucide-react'
import type { DashboardMetrics } from '@/types'

interface MetricsGridProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

interface MetricCard {
  title: string
  value: string
  description: string
  icon: React.ElementType
  iconColor: string
}

function buildCards(metrics: DashboardMetrics): MetricCard[] {
  return [
    {
      title: 'Taken vandaag',
      value: metrics.tasksToday.toString(),
      description: 'Verwerkt door assistenten',
      icon: CheckCircle2,
      iconColor: 'text-green-500',
    },
    {
      title: 'Tijd bespaard',
      value: `${metrics.timeSavedMinutes} min`,
      description: 'Geschatte tijdsbesparing vandaag',
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Actieve assistenten',
      value: `${metrics.activeAssistants}/${metrics.totalAssistants}`,
      description: 'Momenteel actief',
      icon: Bot,
      iconColor: 'text-primary',
    },
    {
      title: 'Open review-items',
      value: metrics.openReviewItems.toString(),
      description: 'Wachten op beoordeling',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
  ]
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  const cards = buildCards(metrics)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Stap 10.2: Commit**

```bash
git add src/components/dashboard/metrics-grid.tsx
git commit -m "feat: metric cards component voor dashboard"
```

---

## Task 11: Assistent-rij en review-item componenten

**Files:**
- Create: `src/components/dashboard/assistant-row.tsx`
- Create: `src/components/dashboard/review-item.tsx`

- [ ] **Stap 11.1: Maak assistant-row.tsx aan**

```typescript
// src/components/dashboard/assistant-row.tsx
'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AssistantStatus } from '@/types'

interface AssistantRowProps {
  id: string
  name: string
  description: string
  status: AssistantStatus
  runsToday: number
  onToggle: (id: string, newStatus: AssistantStatus) => Promise<void>
}

const statusConfig: Record<AssistantStatus, { label: string; dot: string }> = {
  [AssistantStatus.ACTIVE]: { label: 'Actief', dot: 'bg-green-500' },
  [AssistantStatus.PAUSED]: { label: 'Gepauzeerd', dot: 'bg-amber-500' },
  [AssistantStatus.ERROR]: { label: 'Fout', dot: 'bg-red-500' },
}

export function AssistantRow({
  id,
  name,
  description,
  status,
  runsToday,
  onToggle,
}: AssistantRowProps) {
  const [loading, setLoading] = useState(false)
  const config = statusConfig[status]

  const handleToggle = async () => {
    setLoading(true)
    const newStatus =
      status === AssistantStatus.ACTIVE
        ? AssistantStatus.PAUSED
        : AssistantStatus.ACTIVE
    await onToggle(id, newStatus)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <Bot className="h-8 w-8 text-slate-400 shrink-0" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${config.dot}`}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
          <p className="text-xs text-slate-500 truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 ml-4">
        <span className="text-xs text-slate-500 hidden sm:block">
          {runsToday} vandaag
        </span>
        <Badge
          variant="outline"
          className="text-xs hidden sm:flex"
        >
          {config.label}
        </Badge>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            status === AssistantStatus.ACTIVE ? 'bg-primary' : 'bg-slate-200'
          }`}
          aria-label={`Toggle ${name}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              status === AssistantStatus.ACTIVE ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 11.2: Maak review-item.tsx aan**

```typescript
// src/components/dashboard/review-item.tsx
'use client'

import { useState } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReviewPriority, ReviewStatus } from '@/types'

interface ReviewItemProps {
  id: string
  title: string
  description: string
  priority: ReviewPriority
  onAction: (id: string, status: ReviewStatus) => Promise<void>
}

const priorityConfig: Record<ReviewPriority, { label: string; className: string }> = {
  [ReviewPriority.CRITICAL]: {
    label: 'Kritiek',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  [ReviewPriority.HIGH]: {
    label: 'Hoog',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  [ReviewPriority.MEDIUM]: {
    label: 'Midden',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [ReviewPriority.LOW]: {
    label: 'Laag',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

export function ReviewItemCard({
  id,
  title,
  description,
  priority,
  onAction,
}: ReviewItemProps) {
  const [loading, setLoading] = useState<ReviewStatus | null>(null)
  const config = priorityConfig[priority]

  const handleAction = async (status: ReviewStatus) => {
    setLoading(status)
    await onAction(id, status)
    setLoading(null)
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-xs ${config.className}`}>
          {config.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1 border-green-200 text-green-700 hover:bg-green-50"
          disabled={loading !== null}
          onClick={() => handleAction(ReviewStatus.APPROVED)}
        >
          <Check className="h-3 w-3 mr-1" />
          {loading === ReviewStatus.APPROVED ? '...' : 'Goedkeuren'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1 border-red-200 text-red-700 hover:bg-red-50"
          disabled={loading !== null}
          onClick={() => handleAction(ReviewStatus.REJECTED)}
        >
          <X className="h-3 w-3 mr-1" />
          {loading === ReviewStatus.REJECTED ? '...' : 'Afwijzen'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-400"
          asChild
        >
          <a href={`/inbox/${id}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Stap 11.3: Commit**

```bash
git add src/components/dashboard/assistant-row.tsx src/components/dashboard/review-item.tsx
git commit -m "feat: assistant-rij en review-item componenten"
```

---

## Task 12: API routes

**Files:**
- Create: `src/app/api/dashboard/metrics/route.ts`
- Create: `src/app/api/assistants/route.ts`
- Create: `src/app/api/assistants/[id]/route.ts`
- Create: `src/app/api/review/route.ts`
- Create: `src/app/api/review/[id]/route.ts`

- [ ] **Stap 12.1: Dashboard metrics route**

```typescript
// src/app/api/dashboard/metrics/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantRuns, reviewItems } from '@/db/schema'
import { eq, and, gte, count, sql } from 'drizzle-orm'
import { AssistantStatus, ReviewStatus } from '@/types'
import type { DashboardMetrics } from '@/types'

// Demo tenant ID — vervang door sessie-lookup zodra auth compleet is
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [runsToday, allAssistants, activeAssistants, openReviews] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(assistantRuns)
          .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
          .where(
            and(
              eq(assistants.tenantId, DEMO_TENANT_ID),
              gte(assistantRuns.createdAt, today)
            )
          ),
        db
          .select({ count: count() })
          .from(assistants)
          .where(eq(assistants.tenantId, DEMO_TENANT_ID)),
        db
          .select({ count: count() })
          .from(assistants)
          .where(
            and(
              eq(assistants.tenantId, DEMO_TENANT_ID),
              eq(assistants.status, AssistantStatus.ACTIVE)
            )
          ),
        db
          .select({ count: count() })
          .from(reviewItems)
          .where(
            and(
              eq(reviewItems.tenantId, DEMO_TENANT_ID),
              eq(reviewItems.status, ReviewStatus.OPEN)
            )
          ),
      ])

    const tasksToday = runsToday[0]?.count ?? 0
    const total = allAssistants[0]?.count ?? 0
    const active = activeAssistants[0]?.count ?? 0
    const open = openReviews[0]?.count ?? 0

    const metrics: DashboardMetrics = {
      tasksToday: Number(tasksToday),
      timeSavedMinutes: Number(tasksToday) * 3,
      activeAssistants: Number(active),
      totalAssistants: Number(total),
      openReviewItems: Number(open),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[metrics]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 12.2: Assistenten routes**

```typescript
// src/app/api/assistants/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema'
import { eq } from 'drizzle-orm'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const result = await db.query.assistants.findMany({
      where: eq(assistants.tenantId, DEMO_TENANT_ID),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[assistants GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

```typescript
// src/app/api/assistants/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { updateAssistantStatusSchema } from '@/lib/validations'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const assistant = await db.query.assistants.findFirst({
      where: and(
        eq(assistants.id, id),
        eq(assistants.tenantId, DEMO_TENANT_ID)
      ),
    })
    if (!assistant) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }
    return NextResponse.json(assistant)
  } catch (error) {
    console.error('[assistants/[id] GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await request.json()
    const parsed = updateAssistantStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(assistants)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(
        and(eq(assistants.id, id), eq(assistants.tenantId, DEMO_TENANT_ID))
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[assistants/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 12.3: Review routes**

```typescript
// src/app/api/review/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { reviewItems } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { ReviewStatus, ReviewPriority } from '@/types'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

const priorityOrder: Record<ReviewPriority, number> = {
  [ReviewPriority.CRITICAL]: 0,
  [ReviewPriority.HIGH]: 1,
  [ReviewPriority.MEDIUM]: 2,
  [ReviewPriority.LOW]: 3,
}

export async function GET() {
  try {
    const items = await db.query.reviewItems.findMany({
      where: and(
        eq(reviewItems.tenantId, DEMO_TENANT_ID),
        eq(reviewItems.status, ReviewStatus.OPEN)
      ),
      orderBy: (r, { asc }) => [asc(r.createdAt)],
      limit: 50,
    })

    const sorted = [...items].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    )

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('[review GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

```typescript
// src/app/api/review/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reviewItems } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { updateReviewStatusSchema } from '@/lib/validations'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await request.json()
    const parsed = updateReviewStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(reviewItems)
      .set({
        status: parsed.data.status,
        resolvedAt: new Date(),
      })
      .where(
        and(eq(reviewItems.id, id), eq(reviewItems.tenantId, DEMO_TENANT_ID))
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[review/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 12.4: Commit**

```bash
git add src/app/api/
git commit -m "feat: API routes voor metrics, assistenten en review"
```

---

## Task 13: Dashboard pagina

**Files:**
- Create: `src/app/(dashboard)/page.tsx`

- [ ] **Stap 13.1: Maak dashboard pagina aan**

```typescript
// src/app/(dashboard)/page.tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { AssistantRow } from '@/components/dashboard/assistant-row'
import { ReviewItemCard } from '@/components/dashboard/review-item'
import type { DashboardMetrics, AssistantStatus, ReviewStatus } from '@/types'

interface Assistant {
  id: string
  name: string
  description: string
  status: AssistantStatus
  runsToday: number
}

interface ReviewItem {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
}

const MOCK_METRICS: DashboardMetrics = {
  tasksToday: 47,
  timeSavedMinutes: 141,
  activeAssistants: 3,
  totalAssistants: 5,
  openReviewItems: 8,
}

const MOCK_ASSISTANTS: Assistant[] = [
  { id: '1', name: 'Factuurverwerker', description: 'Verwerkt inkomende UBL-facturen', status: 'active', runsToday: 23 },
  { id: '2', name: 'E-mail classifier', description: 'Categoriseert klantvragen', status: 'active', runsToday: 18 },
  { id: '3', name: 'Exact sync', description: 'Synchroniseert boekingen met Exact', status: 'paused', runsToday: 6 },
  { id: '4', name: 'Rapportage bot', description: 'Genereert weekrapporten', status: 'active', runsToday: 0 },
  { id: '5', name: 'Data validator', description: 'Controleert dataqualiteit', status: 'error', runsToday: 0 },
]

const MOCK_REVIEW_ITEMS: ReviewItem[] = [
  { id: 'r1', title: 'Factuur #2024-891 — afwijkend bedrag', description: 'Ontvangen bedrag €1.240 vs verwacht €1.200', priority: 'high', status: 'open' },
  { id: 'r2', title: 'Dubbele boeking gedetecteerd', description: 'Transactie TXN-4421 lijkt al verwerkt', priority: 'critical', status: 'open' },
  { id: 'r3', title: 'Nieuwe leverancier — handmatig goedkeuren', description: 'Acme BV staat nog niet in Exact', priority: 'medium', status: 'open' },
  { id: 'r4', title: 'Classificatie onzeker: algemeen vraag', description: 'Confidence score 52% — beoordeel handmatig', priority: 'low', status: 'open' },
  { id: 'r5', title: 'BTW-code niet herkend', description: 'Code "G3" onbekend in belastingmapping', priority: 'high', status: 'open' },
]

export default function DashboardPage() {
  const queryClient = useQueryClient()

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/metrics')
      if (!res.ok) return MOCK_METRICS
      return res.json() as Promise<DashboardMetrics>
    },
    refetchInterval: 1000 * 30,
    placeholderData: MOCK_METRICS,
  })

  const { data: assistants = MOCK_ASSISTANTS } = useQuery<Assistant[]>({
    queryKey: ['assistants'],
    queryFn: async () => {
      const res = await fetch('/api/assistants')
      if (!res.ok) return MOCK_ASSISTANTS
      return res.json() as Promise<Assistant[]>
    },
    placeholderData: MOCK_ASSISTANTS,
  })

  const { data: reviewItems = MOCK_REVIEW_ITEMS } = useQuery<ReviewItem[]>({
    queryKey: ['review', 'open'],
    queryFn: async () => {
      const res = await fetch('/api/review')
      if (!res.ok) return MOCK_REVIEW_ITEMS
      return res.json() as Promise<ReviewItem[]>
    },
    placeholderData: MOCK_REVIEW_ITEMS,
  })

  const toggleAssistant = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: AssistantStatus
    }) => {
      const res = await fetch(`/api/assistants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Toggle mislukt')
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assistants'] })
    },
  })

  const resolveReview = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: ReviewStatus
    }) => {
      const res = await fetch(`/api/review/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Actie mislukt')
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] })
    },
  })

  const displayedMetrics = metrics ?? MOCK_METRICS
  const topReviewItems = reviewItems.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Overzicht van vandaag
        </p>
      </div>

      {/* Metric cards */}
      <MetricsGrid metrics={displayedMetrics} isLoading={metricsLoading} />

      {/* Assistenten + Review kolommen */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Assistenten lijst — 3/5 breedte */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Assistenten</h2>
            <a
              href="/assistants"
              className="text-xs text-primary hover:underline"
            >
              Alle bekijken →
            </a>
          </div>
          <div className="space-y-2">
            {assistants.map((assistant) => (
              <AssistantRow
                key={assistant.id}
                {...assistant}
                onToggle={async (id, status) => {
                  await toggleAssistant.mutateAsync({ id, status })
                }}
              />
            ))}
          </div>
        </div>

        {/* Review-inbox paneel — 2/5 breedte */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Review-inbox
            </h2>
            {reviewItems.length > 0 && (
              <span className="text-xs text-slate-500">
                {reviewItems.length} open
              </span>
            )}
          </div>
          <div className="space-y-2">
            {topReviewItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-500">Geen open items</p>
              </div>
            ) : (
              topReviewItems.map((item) => (
                <ReviewItemCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  priority={item.priority}
                  onAction={async (id, status) => {
                    await resolveReview.mutateAsync({ id, status })
                  }}
                />
              ))
            )}
          </div>
          {reviewItems.length > 5 && (
            <a
              href="/inbox"
              className="block text-center text-xs text-primary hover:underline mt-2"
            >
              +{reviewItems.length - 5} meer in inbox →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Stap 13.2: Commit**

```bash
git add "src/app/(dashboard)/page.tsx"
git commit -m "feat: dashboard pagina met metrics, assistenten en review-inbox"
```

---

## Task 14: Auth pagina's

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Stap 14.1: Auth layout**

```typescript
// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Stap 14.2: Login pagina**

```typescript
// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Zap, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loginSchema, type LoginInput } from '@/lib/validations'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        setError(body.message ?? 'Inloggen mislukt')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Netwerkfout — probeer opnieuw')
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Zap className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle>Inloggen</CardTitle>
        <CardDescription>BackOffice AI Platform</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              placeholder="naam@bedrijf.nl"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimaal 8 tekens"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full bg-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bezig met inloggen...
              </>
            ) : (
              'Inloggen'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-500">
          Nog geen account?{' '}
          <a href="/register" className="text-primary hover:underline">
            Registreren
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Stap 14.3: Register pagina**

```typescript
// src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Zap, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { registerSchema, type RegisterInput } from '@/lib/validations'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    setError(null)
    try {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { message?: string }
        setError(body.message ?? 'Registratie mislukt')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Netwerkfout — probeer opnieuw')
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Zap className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle>Account aanmaken</CardTitle>
        <CardDescription>BackOffice AI Platform</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Naam</Label>
            <Input
              id="name"
              type="text"
              placeholder="Volledige naam"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              placeholder="naam@bedrijf.nl"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimaal 8 tekens"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full bg-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Account aanmaken...
              </>
            ) : (
              'Account aanmaken'
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-500">
          Al een account?{' '}
          <a href="/login" className="text-primary hover:underline">
            Inloggen
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Stap 14.4: Commit**

```bash
git add "src/app/(auth)/"
git commit -m "feat: login en registratie pagina's"
```

---

## Task 15: Stub pagina's

**Files:**
- Create: `src/app/(dashboard)/assistants/page.tsx`
- Create: `src/app/(dashboard)/inbox/page.tsx`
- Create: `src/app/(dashboard)/integrations/page.tsx`
- Create: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Stap 15.1: Aanmaken stub pagina's**

Maak elk bestand aan met een minimal placeholder:

```typescript
// src/app/(dashboard)/assistants/page.tsx
export default function AssistantsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Alle assistenten</h1>
      <p className="text-sm text-slate-500 mt-1">Overzicht en configuratie</p>
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/inbox/page.tsx
export default function InboxPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Review-inbox</h1>
      <p className="text-sm text-slate-500 mt-1">Openstaande review-items</p>
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/integrations/page.tsx
export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Integraties</h1>
      <p className="text-sm text-slate-500 mt-1">Gekoppelde systemen</p>
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/settings/page.tsx
export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Instellingen</h1>
      <p className="text-sm text-slate-500 mt-1">Account en organisatie</p>
    </div>
  )
}
```

- [ ] **Stap 15.2: Commit**

```bash
git add "src/app/(dashboard)/assistants/" "src/app/(dashboard)/inbox/" "src/app/(dashboard)/integrations/" "src/app/(dashboard)/settings/"
git commit -m "feat: stub pagina's voor navigatiestructuur"
```

---

## Task 16: Docker setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Stap 16.1: Maak Dockerfile aan**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies fase
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# Builder fase
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Runner fase
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root gebruiker
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/node_modules/.bin/drizzle-kit ./node_modules/.bin/drizzle-kit

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Voer migraties uit en start server
CMD ["sh", "-c", "npx drizzle-kit migrate && node server.js"]
```

- [ ] **Stap 16.2: Maak docker-compose.yml aan**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: bom
      POSTGRES_PASSWORD: bom
      POSTGRES_DB: bom
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U bom']
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://bom:bom@postgres:5432/bom
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:-http://localhost:3000}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Stap 16.3: Maak .dockerignore aan**

```
node_modules
.next
.git
.env*.local
.env
npm-debug.log*
README.md
docs/
.claude/
```

- [ ] **Stap 16.4: next.config.ts aanpassen voor standalone output**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Stap 16.5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore next.config.ts
git commit -m "feat: Docker multi-stage build met automatische migraties"
```

---

## Task 17: Verifieer basisshell

- [ ] **Stap 17.1: TypeScript check**

```bash
npx tsc --noEmit
```

Verwacht: geen fouten

- [ ] **Stap 17.2: Next.js build check**

```bash
npm run build
```

Verwacht: succesvolle build zonder errors

- [ ] **Stap 17.3: Dev server opstarten**

```bash
npm run dev
```

Open `http://localhost:3000` — verwacht redirect naar `/login`

- [ ] **Stap 17.4: Finale commit**

```bash
git add -A
git commit -m "feat: basisshell BackOffice AI Platform compleet"
```

---

## Opmerkingen voor uitvoering

- **DEMO_TENANT_ID**: In API routes is een hardcoded demo tenant ID gebruikt. Dit moet vervangen worden door sessie-lookup via `auth.api.getSession()` zodra de volledige auth-flow live is.
- **Drizzle migratie**: Vereist een draaiende PostgreSQL instantie. Start eerst `docker-compose up postgres` als je geen lokale PostgreSQL hebt.
- **Better Auth tabellen**: Worden automatisch aangemaakt bij eerste migratie via de schema definitie in `src/db/schema.ts`.
- **Tailwind v4**: Configuratie via `@theme` in `globals.css` — geen `tailwind.config.ts` nodig voor merktkleuren.

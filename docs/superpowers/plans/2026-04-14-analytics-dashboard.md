# Analytics Dashboard — Activatiegeschiedenis Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een analytics pagina bouwen die via een lijndiagram toont hoeveel assistenten per dag actief waren, gevoed door een PostgreSQL event log die gevuld wordt bij elke toggle in de instellingen.

**Architecture:** Nieuwe `assistant_events` tabel in Drizzle schema → POST/GET API routes → client component `AnalyticsView` met Recharts lijndiagram. Bestaande `assistenten-beheer.tsx` logt fire-and-forget events bij elke toggle.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PostgreSQL, Recharts, Zod, TypeScript

---

### Task 1: `assistant_events` tabel toevoegen aan schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Stap 1: Voeg de tabel toe aan schema.ts**

Voeg onderaan `src/db/schema.ts` toe, na de `integrations` tabel:

```typescript
export const assistantEvents = pgTable('assistant_events', {
  id: text('id').primaryKey(),
  assistantId: text('assistant_id').notNull(),
  assistantName: text('assistant_name').notNull(),
  eventType: text('event_type').notNull(), // 'activated' | 'deactivated'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Stap 2: Genereer de migratie**

```bash
cd "c:/Users/jaap/stack/8. Claude Code/6 BOM/BOM"
npm run db:generate
```

Verwacht: nieuw bestand in `src/db/migrations/` met `CREATE TABLE assistant_events`.

- [ ] **Stap 3: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: voeg assistant_events tabel toe aan schema"
```

---

### Task 2: POST `/api/events` — log een event

**Files:**
- Create: `src/app/api/events/route.ts`

- [ ] **Stap 1: Maak de route aan**

Maak `src/app/api/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantEvents } from '@/db/schema'
import { z } from 'zod'

const createEventSchema = z.object({
  assistantId: z.string().min(1),
  assistantName: z.string().min(1),
  eventType: z.enum(['activated', 'deactivated']),
})

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { assistantId, assistantName, eventType } = parsed.data

    await db.insert(assistantEvents).values({
      id: crypto.randomUUID(),
      assistantId,
      assistantName,
      eventType,
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('[events POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 2: Test handmatig met curl**

```bash
curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"assistantId":"demo-1","assistantName":"Factuurverwerker","eventType":"activated"}'
```

Verwacht: `{"ok":true}` met status 201.

- [ ] **Stap 3: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: POST /api/events voor event logging"
```

---

### Task 3: GET `/api/events/analytics` — geaggregeerde dagdata

**Files:**
- Create: `src/app/api/events/analytics/route.ts`

- [ ] **Stap 1: Maak de analytics route aan**

Maak `src/app/api/events/analytics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantEvents } from '@/db/schema'
import { gte } from 'drizzle-orm'

// Bouw een array van datumstrings voor de afgelopen N dagen
function buildDays(days: number): string[] {
  const result: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().slice(0, 10)) // 'YYYY-MM-DD'
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10), 1), 90)

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    // Haal alle events op in de periode
    const events = await db
      .select()
      .from(assistantEvents)
      .where(gte(assistantEvents.createdAt, since))
      .orderBy(assistantEvents.createdAt)

    const dayLabels = buildDays(days)

    // Per dag: welke assistenten waren actief?
    // Strategie: voor elke dag kijken wat het laatste event per assistent was vóór of op die dag
    const allAssistantIds = [...new Set(events.map((e) => e.assistantId))]

    const dailyCounts = dayLabels.map((day) => {
      const endOfDay = new Date(day + 'T23:59:59.999Z')
      let active = 0
      for (const id of allAssistantIds) {
        const assistantEvents = events
          .filter((e) => e.assistantId === id && e.createdAt <= endOfDay)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        if (assistantEvents[0]?.eventType === 'activated') active++
      }
      return { date: day, active }
    })

    // Haal ook de laatste 20 events op als feed
    const recentEvents = [...events]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        assistantId: e.assistantId,
        assistantName: e.assistantName,
        eventType: e.eventType,
        createdAt: e.createdAt.toISOString(),
      }))

    return NextResponse.json({ dailyCounts, recentEvents })
  } catch (error) {
    console.error('[events/analytics GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
```

- [ ] **Stap 2: Test de route**

```bash
curl -s "http://localhost:3000/api/events/analytics?days=7"
```

Verwacht: `{"dailyCounts":[{"date":"...","active":0},...], "recentEvents":[]}` (leeg want nog geen events).

- [ ] **Stap 3: Commit**

```bash
git add src/app/api/events/analytics/route.ts
git commit -m "feat: GET /api/events/analytics geaggregeerde dagdata"
```

---

### Task 4: Event logging integreren in assistenten-beheer

**Files:**
- Modify: `src/components/settings/assistenten-beheer.tsx`

- [ ] **Stap 1: Voeg de logEvent helper toe**

Voeg bovenaan de component (na de imports, voor de constanten) toe:

```typescript
async function logEvent(
  assistantId: string,
  assistantName: string,
  eventType: 'activated' | 'deactivated'
) {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantId, assistantName, eventType }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.error('[logEvent] kon event niet loggen:', { assistantId, assistantName, eventType, error })
  }
}
```

- [ ] **Stap 2: Roep logEvent aan in handleToggle**

Zoek in `handleToggle` de regel `setStatus(a.id, newStatus)` en voeg daarna toe:

```typescript
// Fire-and-forget: log event naar database
void logEvent(a.id, a.name, newStatus === 'active' ? 'activated' : 'deactivated')
```

- [ ] **Stap 3: Roep logEvent aan in handleSave**

Zoek in `handleSave` de regel `setStatus(editingId, newStatus)` en voeg daarna toe:

```typescript
// Log alleen als de status daadwerkelijk wijzigt
const currentStatus = assistants.find((x) => x.id === editingId)?.status
if (currentStatus !== newStatus) {
  void logEvent(editingId, form.name, newStatus === 'active' ? 'activated' : 'deactivated')
}
```

- [ ] **Stap 4: Verifieer in browser**

1. Open de app lokaal (`npm run dev`)
2. Ga naar Instellingen → Assistenten beheer
3. Toggle een assistent aan/uit
4. Controleer: `curl -s "http://localhost:3000/api/events/analytics?days=7"` — `recentEvents` bevat nu het event

- [ ] **Stap 5: Commit**

```bash
git add src/components/settings/assistenten-beheer.tsx
git commit -m "feat: log activatie-events naar database bij toggle"
```

---

### Task 5: Recharts installeren

**Files:**
- Modify: `package.json`

- [ ] **Stap 1: Installeer recharts**

```bash
cd "c:/Users/jaap/stack/8. Claude Code/6 BOM/BOM"
npm install recharts
```

- [ ] **Stap 2: Verifieer TypeScript**

```bash
npx tsc --noEmit
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: voeg recharts toe voor analytics grafiek"
```

---

### Task 6: AnalyticsView component

**Files:**
- Create: `src/components/analytics/analytics-view.tsx`

- [ ] **Stap 1: Maak het component aan**

Maak `src/components/analytics/analytics-view.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'

const TEAL = '#1D9E75'

interface DayCount {
  date: string
  active: number
}

interface RecentEvent {
  id: string
  assistantId: string
  assistantName: string
  eventType: 'activated' | 'deactivated'
  createdAt: string
}

interface AnalyticsData {
  dailyCounts: DayCount[]
  recentEvents: RecentEvent[]
}

const PERIOD_OPTIONS = [
  { label: '7 dagen', value: 7 },
  { label: '30 dagen', value: 30 },
  { label: '90 dagen', value: 90 },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function AnalyticsView() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/events/analytics?days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<AnalyticsData>
      })
      .then(setData)
      .catch(() => setError('Kon analytics niet laden'))
      .finally(() => setLoading(false))
  }, [days])

  const totalEvents = data?.recentEvents.length ?? 0
  const activeToday = data?.dailyCounts.at(-1)?.active ?? 0
  const mostActive = data?.recentEvents.reduce<Record<string, number>>((acc, e) => {
    if (e.eventType === 'activated') acc[e.assistantName] = (acc[e.assistantName] ?? 0) + 1
    return acc
  }, {})
  const mostActiveName = mostActive
    ? Object.entries(mostActive).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    : '—'

  const chartData = data?.dailyCounts.map((d) => ({
    ...d,
    label: formatDate(d.date),
  })) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        height: 52, background: '#fff', borderBottom: '0.5px solid #EAECEF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>Analyse</span>

        {/* Periode dropdown */}
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            height: 32, padding: '0 10px', borderRadius: 7,
            border: '0.5px solid #E2E8F0', fontSize: 12,
            color: '#374151', background: '#fff', cursor: 'pointer',
            fontFamily: 'inherit', outline: 'none',
          }}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats balk */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Totaal events', value: data?.recentEvents.length ?? '—' },
            { label: 'Meest actief',  value: mostActiveName },
            { label: 'Actief vandaag', value: activeToday },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#fff', border: '0.5px solid #EAECEF',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Grafiek */}
        <div style={{
          background: '#fff', border: '0.5px solid #EAECEF',
          borderRadius: 12, padding: '20px 16px 12px',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 16px 8px' }}>
            Actieve assistenten per dag
          </p>

          {loading && (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>Laden...</span>
            </div>
          )}

          {error && (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEAL} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(value: number) => [value, 'Actief']}
                />
                <Area
                  type="monotone" dataKey="active"
                  stroke={TEAL} strokeWidth={2}
                  fill="url(#tealGradient)"
                  dot={{ fill: TEAL, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: TEAL }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recente events feed */}
        <div style={{
          background: '#fff', border: '0.5px solid #EAECEF',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 12px' }}>
            Recente events
          </p>

          {!loading && data?.recentEvents.length === 0 && (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Nog geen events — schakel een assistent in of uit om te beginnen.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data?.recentEvents.map((e) => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0', borderBottom: '0.5px solid #F8FAFC',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: e.eventType === 'activated' ? TEAL : '#D1D5DB',
                }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#0F172A' }}>
                  {e.assistantName}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: e.eventType === 'activated' ? TEAL : '#9CA3AF',
                  background: e.eventType === 'activated' ? '#ECFDF5' : '#F3F4F6',
                  padding: '2px 7px', borderRadius: 5,
                }}>
                  {e.eventType === 'activated' ? 'Geactiveerd' : 'Gedeactiveerd'}
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                  {formatDateTime(e.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Stap 2: TypeScript check**

```bash
npx tsc --noEmit
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/components/analytics/analytics-view.tsx
git commit -m "feat: AnalyticsView component met lijndiagram en event feed"
```

---

### Task 7: Analytics pagina aanmaken

**Files:**
- Create: `src/app/(dashboard)/analytics/page.tsx`

- [ ] **Stap 1: Maak de pagina aan**

Maak `src/app/(dashboard)/analytics/page.tsx`:

```typescript
import { AnalyticsView } from '@/components/analytics/analytics-view'

export default function AnalyticsPage() {
  return <AnalyticsView />
}
```

- [ ] **Stap 2: Verifieer in browser**

1. Start dev server: `npm run dev`
2. Ga naar `http://localhost:3000/analytics`
3. Pagina laadt zonder fouten, grafiek toont lege data

- [ ] **Stap 3: Commit**

```bash
git add "src/app/(dashboard)/analytics/page.tsx"
git commit -m "feat: analytics pagina onder /analytics"
```

---

### Task 8: Drizzle migratie uitvoeren

- [ ] **Stap 1: Voer de migratie uit**

```bash
npm run db:migrate
```

Verwacht: migratie succesvol, tabel `assistant_events` aangemaakt.

- [ ] **Stap 2: Commit + push + deploy**

```bash
git push origin main
```

Trigger daarna een Coolify deploy.

---

### Task 9: Playwright test toevoegen

**Files:**
- Create: `e2e/analytics.spec.ts`

- [ ] **Stap 1: Maak de test aan**

Maak `e2e/analytics.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Analytics pagina', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics')
  })

  test('pagina laadt zonder fouten', async ({ page }) => {
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
  })

  test('toont topbar met titel Analyse', async ({ page }) => {
    await expect(page.locator('text=Analyse').first()).toBeVisible()
  })

  test('toont periode dropdown met 7 dagen als standaard', async ({ page }) => {
    const dropdown = page.getByRole('combobox')
    await expect(dropdown).toHaveValue('7')
  })

  test('toont de drie stat-blokjes', async ({ page }) => {
    await expect(page.getByText('Totaal events')).toBeVisible()
    await expect(page.getByText('Meest actief')).toBeVisible()
    await expect(page.getByText('Actief vandaag')).toBeVisible()
  })

  test('toont recente events sectie', async ({ page }) => {
    await expect(page.getByText('Recente events')).toBeVisible()
  })

  test('periode dropdown wijzigt naar 30 dagen', async ({ page }) => {
    await page.getByRole('combobox').selectOption('30')
    await expect(page.getByRole('combobox')).toHaveValue('30')
  })

  test('sidebar link Analyse navigeert naar /analytics', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Analyse' }).click()
    await expect(page).toHaveURL(/\/analytics/)
  })
})
```

- [ ] **Stap 2: Commit**

```bash
git add e2e/analytics.spec.ts
git commit -m "test: Playwright spec voor analytics pagina"
```

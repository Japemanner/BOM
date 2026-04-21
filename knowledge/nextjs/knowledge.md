# Next.js — Feiten en patronen

## BOM-specifieke feiten

- Next.js 15 App Router met turbopack (`next dev --turbopack`)
- Server Components by default; `'use client'` alleen als echt nodig
- Middleware: alleen cookie-checks, geen DB-calls (O(1) latency)
- Auth bypass voor E2E via `SKIP_AUTH_REDIRECT=true` env var
- shadcn/ui componenten — `CardTitle` rendert als `<div>`, niet als heading

## Patronen

- API routes: `NextResponse.json()` met expliciete HTTP-statuscodes
- Protected routes: `canDo()` check vóór elke schrijfoperatie
- Tenant context altijd uit sessie/request, nooit hardcoded
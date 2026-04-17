# Code stijlregels — BOM Platform

## TypeScript

- Gebruik `const X = {...} as const; type X = ...` patroon voor enum-achtige waarden (zie `src/types/index.ts`)
- Geen `any` — gebruik `unknown` + type narrowing
- Drizzle schema types: gebruik `$inferSelect` / `$inferInsert` voor afgeleide types
- `async/await` over `.then()` chains

## Next.js App Router

- Server Components by default; `'use client'` alleen als echt nodig
- API routes: altijd `NextResponse.json()` met expliciete HTTP-statuscodes
- Middleware: alleen cookie-checks, geen database-calls

## Naamgeving

- Bestanden: `kebab-case.ts`
- Componenten: `PascalCase.tsx`
- DB-kolommen: `snake_case` in SQL, `camelCase` in Drizzle
- API-routes: REST-achtig (`/api/assistants`, `/api/assistants/[id]`)

## Imports

- Gebruik `@/` aliassen (`@/db`, `@/lib`, `@/types`, `@/components`)
- Importeer altijd uit het meest specifieke subpad: `@/db/schema/app` niet `@/db/schema`

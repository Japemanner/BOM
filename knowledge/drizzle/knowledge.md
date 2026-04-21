# Drizzle ORM — Feiten en patronen

## BOM-specifieke feiten

- Drizzle ORM 0.45 met PostgreSQL 18 (pgvector)
- Schema's verdeeld over 4 domeinen: `auth.ts`, `iam.ts`, `rbac.ts`, `app.ts`
- Barrel export via `schema/index.ts`
- Kolommen: `snake_case` in SQL, `camelCase` in Drizzle
- Types: `$inferSelect` / `$inferInsert` voor afgeleide types
- RBAC seed via `npx tsx src/db/seed-rbac.ts` (idempotent)

## Patronen

- Importeer altijd uit meest specifieke subpad: `@/db/schema/app` niet `@/db/schema`
- Geen `$type<>` casting als type uit schema infereerbaar is
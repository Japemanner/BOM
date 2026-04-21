# Drizzle ORM — Bevestigde regels

_Regels die 3+ keer bevestigd zijn en standaard toegepast moeten worden._

- Importeer uit meest specifieke subpad: `@/db/schema/app` niet `@/db/schema`
- Gebruik `$inferSelect` / `$inferInsert` i.p.v. handmatige type-definities
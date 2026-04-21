# RBAC — Bevestigde regels

_Regels die 3+ keer bevestigd zijn en standaard toegepast moeten worden._

- Nooit directe `rbac.*` queries buiten `src/lib/permissions.ts`
- Altijd `canDo()` check vóór schrijfoperaties in API routes
# RBAC — Feiten en patronen

## BOM-specifieke feiten

- Twee rollen: `admin` (16 permissies incl. `webhooks.manage`) en `member` (3 permissies)
- Member-permissies: read op assistants, integrations, tenant
- Permissiecheck via `canDo(userId, tenantId, resource, action)` in `src/lib/permissions.ts`
- `canDo()` gebruikt 3-table join — geen N+1
- Directe queries op `rbac.*` buiten `src/lib/permissions.ts` zijn niet toegestaan
- RBAC seed is idempotent: `npx tsx src/db/seed-rbac.ts`

## Patronen

- Elke schrijfoperatie in API routes: `if (!await canDo(...)) return 403`
- Nieuwe permissies toevoegen: seed aanpassen + `canDo()` updaten
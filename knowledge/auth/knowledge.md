# Better Auth — Feiten en patronen

## BOM-specifieke feiten

- Better Auth met email/password + magic link
- Auth-tabellen: `auth.*` (users, sessions, accounts, verifications)
- Alleen gelezen door Better Auth en `src/lib/auth.ts`
- E2E auth bypass: `SKIP_AUTH_REDIRECT=true` in playwright config

## Patronen

- Auth-config gecentraliseerd in `src/lib/auth.ts`
- Nieuwe auth-gerelateerde logica altijd via Better Auth API, niet direct op tabellen
# Architectuurregels — BOM Platform

## Leidend principe: Theory of Constraints (ToC)

Identificeer en elimineer de bottleneck in de dataflow voordat je nieuwe features toevoegt. In BOM zijn de kritieke beperkingen:

1. **Database roundtrips** — gebruik joins in plaats van N+1 queries. De `canDo()` helper doet dit al correct met één 3-table join.
2. **Auth middleware** — elke protected request passeert de middleware; houd die O(1) (cookie-check, geen DB-call).
3. **Tenant isolation** — elke query op app.* of iam.* moet gefilterd zijn op `tenant_id`. Nooit cross-tenant data returnen.

### ToC-checklist voor nieuwe features

- [ ] Voegt deze feature een nieuwe DB-roundtrip toe per request? Zo ja — kan het met een join?
- [ ] Raakt deze feature de auth/middleware flow? Zo ja — blijft de latency onder 5ms?
- [ ] Leest/schrijft deze feature data voor meerdere tenants? Zo nee — `tenant_id` filter aanwezig?

---

## Ontkoppeling (Microservices-principes)

BOM is een monoliet, maar de interne grenzen moeten losjes gekoppeld blijven:

### API-contracten

- Elke `app/api/` route is een expliciet contract: input validatie via Zod, output altijd getypeerd.
- Routes mogen **niet** direct andere routes aanroepen — gebruik gedeelde db-queries of lib-functies.
- Breaking changes in een API-route vereisen een versienummer (`/api/v2/...`) of migratie van consumers.

### Schema-grenzen

```
auth.*   →  alleen gelezen door Better Auth en src/lib/auth.ts
iam.*    →  toegangspunt voor tenant/member logica
rbac.*   →  alleen gelezen via canDo() — nooit direct in routes
app.*    →  business logica, altijd gefilterd op tenant_id
```

Directe queries op `rbac.*` buiten `src/lib/permissions.ts` zijn **niet toegestaan**.

### Eventgedreven patronen

`app.assistant_events` heeft opzettelijk **geen FK** naar assistants — events zijn immutable audit logs die de levensduur van de assistent overleven. Behandel ze als append-only.

---

## Codeconventies

- **Code:** Engels
- **Comments, commits, PR-beschrijvingen:** Nederlands
- **Geen `$type<>` casting** als het type al uit het schema infereerbaar is
- **Geen hardcoded tenant IDs** — altijd uit sessie of request context halen
- **Permissiecheck** vóór elke schrijfoperatie in API routes: `if (!await canDo(...)) return 403`

# API Conventies — BOM Platform

## Input validatie

- Elke API route gebruikt Zod voor input validatie
- Valideer request body, query params en route params expliciet
- Geen onbekende velden doorlaten — Zod `strict()` waar mogelijk

## Output

- Altijd `NextResponse.json()` met getypeerde response
- Expliciete HTTP-statuscodes (200, 201, 400, 403, 404, 500)
- Foutresponses: `{ error: string, details?: unknown }` formaat

## Route contracten

- Routes mogen **niet** direct andere routes aanroepen
- Gebruik gedeelde db-queries of lib-functies voor hergebruikte logica
- Breaking changes vereisen versienummer (`/api/v2/...`) of migratie van consumers

## Authenticatie & Autorisatie

- Schrijfoperaties: `if (!await canDo(userId, tenantId, resource, action)) return 403`
- Tenant context altijd uit sessie of request context, nooit hardcoded
- Geen logging van persoonlijke data (email, naam) in plaintext

## REST-conventies

- Resource endpoints: `/api/{resource}` (list + create), `/api/{resource}/{id}` (get + update + delete)
- Nieuwe resources volgen bestaand patroon uit `/api/assistants/`
- Webhook-specifieke routes: `/api/webhooks/inbound`, `/api/webhooks/tokens`
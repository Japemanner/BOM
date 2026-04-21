# BOM Domein — Feiten en patronen

## Kernconcepten

- Multi-tenant SaaS: elke organisatie is een tenant
- AI-assistenten per tenant: factuurverwerking, e-mailclassificatie, ERP-sync, documentcontrole
- Tenant isolation: elke `app.*` query MOET gefilterd zijn op `tenant_id`

## Entiteiten

- `assistants` — AI-assistenten met webhook URL + encrypted token
- `assistant_runs` — uitvoeringen van assistenten
- `assistant_events` — immutable audit logs, append-only, geen FK naar assistants
- `review_items` — beoordelingen met prioriteit-sortering
- `webhook_tokens` — AES-256-GCM encrypted tokens (ENCRYPTION_KEY vereist)

## Webhook flow

- Outbound: N8N getriggerd na assistant run
- Inbound: POST via `/api/webhooks/inbound` met bearer token auth
- Token management: aanmaken, kopiëren, intrekken via `/api/webhooks/tokens`

## Architectuurprincipes

- Theory of Constraints: elimineer bottleneck vóór nieuwe features
- Ontkoppeling: routes mogen niet direct andere routes aanroepen
- Eventgedreven: `assistant_events` zijn append-only audit logs
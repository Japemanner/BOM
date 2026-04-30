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
- `knowledge_sources` — tenant-breed kennisbronnen (vector databases) voor RAG
- `assistant_knowledge_sources` — many-to-many koppeling assistent ↔ kennisbron
- `rag_documents` — document uploads voor vectorisatie (gekoppeld aan kennisbron of assistent)

## Webhook flow

- Outbound: N8N getriggerd na assistant run
- Inbound: POST via `/api/webhooks/inbound` met bearer token auth
- Token management: aanmaken, kopiëren, intrekken via `/api/webhooks/tokens`

## Architectuurprincipes

- Theory of Constraints: elimineer bottleneck vóór nieuwe features
- Ontkoppeling: routes mogen niet direct andere routes aanroepen
- Eventgedreven: `assistant_events` zijn append-only audit logs

## Deployment

Push naar `main` gebeurt aan het einde van elke afgeronde taak. Deze push triggert
automatisch een deploy van de applicatie.
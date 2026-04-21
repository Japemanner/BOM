# BOM Domein — Bevestigde regels

- Elke `app.*` query heeft een `tenant_id` filter
- `assistant_events` zijn append-only — geen updates, geen deletes
- Webhook tokens altijd encrypted opgeslagen (AES-256-GCM)
- Geen Amerikaanse providers zonder expliciete goedkeuring
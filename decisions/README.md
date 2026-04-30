# Decision Journal — BOM Platform

Architectuur- en ontwerpbeslissingen die verder gaan dan de taak van vandaag.

## Formaat

```markdown
## Decision: {wat besloten}
## Context: {waarom kwam dit naar boven}
## Alternatives considered: {welke andere opties er waren}
## Reasoning: {waarom deze optie won}
## Trade-offs accepted: {wat je opgaf}
## Supersedes: {link naar vorige decision, indien vervanging}
```

## Deployment strategie

Push naar `main` gebeurt aan het einde van elke afgeronde taak. Deze push triggert
automatisch een deploy van de applicatie.

```bash
# Workflow aan het einde van elke afgeronde taak:
npm run typecheck   # TypeScript controle
npm run lint        # ESLint controle
git push origin main # Deploy trigger
```

## Bestaande beslissingen

| Datum | Topic | Bestand |
|-------|-------|---------|
| 2026-04-10 | Backoffice AI Platform | `docs/superpowers/plans/2026-04-10-backoffice-ai-platform.md` |
| 2026-04-14 | Analytics Dashboard | `docs/superpowers/plans/2026-04-14-analytics-dashboard.md` |
| 2026-04-15 | RBAC Schema Split | `docs/superpowers/plans/2026-04-15-rbac-schema-split.md` |
| 2026-04-18 | N8N Webhook Integration | `docs/superpowers/plans/2026-04-18-n8n-webhook-integration.md` |

_Nieuwe beslissingen hieronder toevoegen in het bovenstaande formaat._
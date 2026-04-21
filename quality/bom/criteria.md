# Quality Gate — BOM Platform

## Criteria

Elke taak wordt geëvalueerd tegen onderstaande criteria voordat deze als voltooid wordt gemarkeerd.

### Functioneel

| # | Criterium | Gewicht |
|---|-----------|---------|
| F1 | Feature werkt zoals gespecificeerd | verplicht |
| F2 | Randgevallen afgehandeld (lege state, errors) | hoog |
| F3 | E2E test toegevoegd of bijgewerkt | middel |

### Architectuur

| # | Criterium | Gewicht |
|---|-----------|---------|
| A1 | Tenant isolation: elke `app.*` query heeft `tenant_id` filter | verplicht |
| A2 | Permissiecheck: `canDo()` vóór elke schrijfoperatie | verplicht |
| A3 | Schema-grenzen gerespecteerd: geen directe `rbac.*` queries | verplicht |
| A4 | Geen nieuwe N+1 queries — joins waar mogelijk | hoog |
| A5 | Middleware blijft O(1) — geen DB-calls | hoog |

### Codekwaliteit

| # | Criterium | Gewicht |
|---|-----------|---------|
| C1 | `npm run typecheck` slaagt | verplicht |
| C2 | `npm run lint` slaagt | verplicht |
| C3 | Geen `any` types | verplicht |
| C4 | Code in Engels, comments/uitleg in Nederlands | middel |
| C5 | Imports uit meest specifieke subpad | middel |

### Veiligheid

| # | Criterium | Gewicht |
|---|-----------|---------|
| S1 | Geen secrets hardcoded — `.env.local` | verplicht |
| S2 | Geen logging van persoonlijke data in plaintext | verplicht |
| S3 | GDPR/AVG compliant — geen US providers zonder goedkeuring | verplicht |

### Schaal

| # | Criterium | Gewicht |
|---|-----------|---------|
| V1 | Geen hardcoded tenant IDs | verplicht |
| V2 | Webhook tokens encrypted (AES-256-GCM) waar van toepassing | hoog |

## Evaluatieformat

```markdown
## Output: {korte beschrijving}
## Criteria checked:
  - {criterium}: PASS / FAIL / PARTIAL — {observatie}
## Score: {X}/{total}
## Gaps: {wat beter kan}
## Verdict: SHIP / REVISE / REJECT
```

### Thresholds

- **SHIP**: alle verplichte criteria PASS + ≥80% overige criteria PASS
- **REVISE**: een verplicht criterium FAIL of <80% overige criteria PASS
- **REJECT**: meerdere verplichte criteria FAIL
# Next.js — Bevestigde regels

_Regels die 3+ keer bevestigd zijn en standaard toegepast moeten worden._

- Middleware doet GEEN database-calls — O(1) latency vereist
- `'use client'` alleen als interactivity of browser APIs nodig zijn
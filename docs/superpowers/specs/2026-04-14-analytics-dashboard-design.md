# Design: Analytics Dashboard — Activatiegeschiedenis assistenten

**Datum:** 2026-04-14
**Status:** Goedgekeurd

---

## Doel

Een analytics pagina onder "Analyse" in de sidebar die toont wanneer welke assistent geactiveerd of gedeactiveerd is, weergegeven als een lijndiagram over tijd.

---

## Data model

Nieuwe tabel `assistant_events` in PostgreSQL (Drizzle ORM):

| kolom           | type          | beschrijving                                      |
|----------------|---------------|---------------------------------------------------|
| id             | text (PK)     | Gegenereerd ID                                    |
| assistantId    | text          | ID van de assistent                               |
| assistantName  | text          | Naam op moment van event (snapshot, geen FK)      |
| eventType      | text          | `'activated'` of `'deactivated'`                  |
| createdAt      | timestamp     | Tijdstip van het event (default: now())           |

Geen foreign key naar `assistants` — geschiedenis blijft intact na verwijdering van een assistent.

---

## API routes

### POST `/api/events`
Log een activatie- of deactivatie-event.

**Request body:**
```json
{ "assistantId": "demo-1", "assistantName": "Factuurverwerker", "eventType": "activated" }
```

**Response:** 201 Created

### GET `/api/events/analytics?days=7`
Haal geaggregeerde dagelijkse data op.

**Response:**
```json
[
  { "date": "2026-04-08", "active": 3 },
  { "date": "2026-04-09", "active": 3 }
]
```

Server berekent per dag hoeveel assistenten actief waren door events te verwerken (laatste event per assistent per dag bepaalt de status).

---

## Frontend

**Locatie:** `src/app/(dashboard)/analytics/page.tsx` + `src/components/analytics/analytics-view.tsx`

**Layout:**
- Topbar (52px, wit): titel "Analyse"
- Tijdperiode dropdown rechtsboven: 7 dagen (standaard) / 30 dagen / 90 dagen
- Samenvattingsbalk: 3 stat-blokjes — "Totaal events", "Meest actieve assistent", "Actief vandaag"
- Lijndiagram (Recharts `LineChart`): X-as = datum, Y-as = aantal actieve assistenten. Teal lijn (`#1D9E75`) met lichte vulling
- Evenemententabel onder grafiek: laatste 20 events — naam + type + tijdstip

**Data fetching:** client component, `fetch('/api/events/analytics?days=7')` bij mount en bij wijzigen tijdperiode.

---

## Integratie met toggle logica

In `assistenten-beheer.tsx`:

1. **`handleToggle`** — na elke statuswijziging: `POST /api/events`
2. **`handleSave`** — als offline-toggle wijzigt t.o.v. huidige status: `POST /api/events`

Beide calls zijn **fire-and-forget** (geen `await` op UI-flow). Bij een fout: `console.error` met event-details en foutmelding zodat het in de logs zichtbaar is. De UI wordt niet geblokkeerd.

---

## Dependencies

- `recharts` — lijndiagram (nieuw toe te voegen)
- Bestaande Drizzle ORM + PostgreSQL setup
- Bestaande `better-auth` ID-generatie of `crypto.randomUUID()`

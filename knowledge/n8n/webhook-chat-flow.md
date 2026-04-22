# N8N Chat Webhook Flow

> Gebruik: route chatberichten van BOM door een N8N workflow naar een LLM (Scaleway/Mistral/OpenAI).

## Architecture

```
BOM UI (ChatWindow)
  ↓ POST /api/chat
BOM Next.js API Route
  ↓ POST N8N Webhook (request-response)
N8N Workflow
  ↓ Validate JWT
  ↓ Call LLM
N8N Webhook Response
  ↓ { "text": "AI antwoord..." }
BOM Next.js API Route
  ↓ JSON response
BOM UI (ChatWindow)
```

## BOM outbound payload

BOM stuurt naar de N8N webhook URL:

```json
{
  "message": "Hoeveel facturen zijn deze week verwerkt?",
  "history": [
    { "role": "assistant", "content": "Hallo! Ik ben FactuurBot. Hoe kan ik je vandaag helpen?" },
    { "role": "user", "content": "Hoeveel facturen deze week?" }
  ],
  "assistantId": "uuid-van-assistent",
  "assistantName": "FactuurBot",
  "tenantId": "uuid-van-tenant",
  "tenantName": "ACME BV",
  "userId": "uuid-van-user",
  "userName": "Piet Jansen",
  "traceId": "uuid-van-tenant-uuid-van-run",
  "timestamp": "2026-04-22T14:30:00.000Z"
}
```

### N8N JWT validatie

Elk request bevat een `Authorization: Bearer <jwt>` header.

Het JWT is ondertekend met HS256, het shared secret staat in `assistants.webhook_token_encrypted` (AES-256-GCM encrypted in DB).

**JWT claims** (uit de header, niet de body):

| Claim | Waarde |
|-------|--------|
| `runId` | `runId` deel van `traceId` (= alles na de eerste 36 tekens) |
| `assistantId` | UUID van de assistent |
| `assistantName` | Naam van de assistent |
| `tenantId` | UUID van de tenant |
| `iss` | `bom` |
| `aud` | `n8n` |
| `iat` | Unix timestamp |
| `exp` | `iat + 1h` |

Valideer in N8N:

1. Haal `Authorization` header op
2. Strip `Bearer `
3. Valideer met HS256 en het shared secret
4. Controleer `iss === 'bom'` en `aud === 'n8n'`

Voorbeeld (N8N Function node):

  ```javascript
  // traceId = "{tenantId}-{runId}"
  // tenantId = traceId.slice(0, 36)
  // runId = traceId.slice(37)
  ```

## N8N Response format

N8N moet antwoorden met HTTP 200 en JSON body:

```json
{
  "text": "Dit is het AI-antwoord dat in de chat verschijnt.",
  "meta": {
    "model": "mistral-large",
    "tokensUsed": 142
  }
}
```

Vereist veld: `text` (string). Optioneel: `meta` (object).

Als `text` ontbreekt, retourneert BOM fout: `N8N webhook retourneerde geen "text" of "response" veld`.

## N8N Workflow design (voorbeeld)

### Nodes

1. **Webhook Trigger** (POST)
   - Path: `/webhook/chat`
   - Response Mode: `Last Node`
   - Authentication: geen (JWT zit in header, valideer zelf)

2. **Function** — JWT validatie
   - Code zoals hierboven
   - Bij ongeldig: throw error → workflow stopt, retourneert 500

3. **Function** — Bericht extractie
   - Pak `$json.message` en `$json.history`
   - Bouw LLM prompt: combineer system prompt + history + nieuw bericht

4. **HTTP Request** — LLM API call
   - URL: `https://api.scaleway.ai/...` of Mistral/OpenAI
   - Headers: `Authorization: Bearer <llm-api-key>`
   - Body: `{ model, messages, temperature }`
   - Timeout: 25s

5. **Function** — Response formatting
   - Pak LLM response tekst
   - Return: `{ text: "...", meta: { model, tokensUsed } }`
   - Deze output wordt automatisch als HTTP 200 body geretourneerd door de Webhook node

### Response Mode

Stel de Webhook node in op **Response Mode = Last Node** zodat de output van de laatste Function node direct als HTTP response teruggestuurd wordt naar BOM.

## Fout-afhandeling

| Scenario | BOM gedrag |
|----------|-----------|
| N8N niet bereikbaar | 502 Bad Gateway, AI stelt "N8N webhook timeout na 30s" |
| JWT ongeldig | 401/403 in N8N, BOM krijgt HTTP error |
| N8N retourneert geen `text` | 502, AI stelt foutmelding |
| N8N HTTP error (4xx/5xx) | 502, AI stelt "N8N webhook HTTP {status}" |

## Timeout

BOM wacht maximaal **30 seconden** op een antwoord van N8N. Gebruik in N8N een kortere timeout (bijv. 25s) op de LLM call zodat er altijd tijd is voor response formatting.

## Security best practices

- Bewaar het N8N shared secret nooit in plain text in N8N workflows. Gebruik N8N **Credentials**.
- Zet in N8N de webhook URL op een niet- raadbaar pad (bijv. `/webhook/chat-a7f3x9`).
- Beperk de N8N webhook node tot `POST` alleen.
- Schakel `Return Same Data` uit in de Webhook node — we willen geen request echo's.
- Log in N8N de `runId` en `tenantId` voor audit trail (niet in plain text naar externe logging).

## Migration: van placeholder naar live

1. In BOM: open een assistent → instellingen → vul **Webhook URL** en **JWT Secret** in.
2. In N8N: importeer of bouw de workflow hierboven.
3. Kopieer de N8N webhook URL naar het BOM assistent veld.
4. Genereer een shared secret in BOM (Settings → Webhook tokens) en plak deze in N8N credentials.
5. Test: stuur een chatbericht in BOM. Controleer N8N execution logs.

## Test payload (cURL)

```bash
curl -X POST https://jouw-bom.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=..." \
  -d '{
    "assistantId": "uuid-hier",
    "message": "Hallo wereld",
    "history": []
  }'
```

Verwachte response:

```json
{
  "ok": true,
  "text": "Hallo! Hoe kan ik je helpen?",
  "runId": "uuid-van-run"
}
```

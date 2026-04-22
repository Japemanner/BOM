// src/lib/outbound-webhook.ts
import { SignJWT } from 'jose'

export interface OutboundWebhookClaims {
  runId: string
  assistantId: string
  assistantName: string
  tenantId: string
}

/**
 * Sign een JWT voor de outbound webhook naar N8N.
 * N8N valideert dit JWT met hetzelfde shared secret.
 */
export async function createOutboundJwt(
  secret: string,
  claims: OutboundWebhookClaims
): Promise<string> {
  const key = new TextEncoder().encode(secret)

  return new SignJWT({
    runId: claims.runId,
    assistantId: claims.assistantId,
    assistantName: claims.assistantName,
    tenantId: claims.tenantId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setAudience('n8n')
    .setIssuer('bom')
    .sign(key)
}

export interface OutboundWebhookPayload {
  /** Het volledige chatbericht van de gebruiker */
  message: string
  /** Volledige berichtengeschiedenis als context voor de LLM */
  history: { role: 'user' | 'assistant'; content: string }[]
  /** Metadata die N8N kan gebruiken voor routing/logging */
  meta: {
    assistantId: string
    assistantName: string
    tenantId: string
    runId: string
    timestamp: string
  }
}

export interface OutboundWebhookResult {
  ok: true
  /** Het antwoord van N8N (AI response) */
  text: string
  /** Optionele metadata terug van N8N */
  meta?: Record<string, unknown>
}

export interface OutboundWebhookError {
  ok: false
  error: string
  status?: number
}

/**
 * Roep een N8N webhook aan met request-response pattern.
 * BOM stuurt bericht + context, wacht op AI-antwoord in HTTP body.
 * Timeout: 30 seconden (N8N workflows kunnen lang lopen bij LLM calls).
 */
export async function callOutboundWebhook(
  webhookUrl: string,
  secret: string,
  payload: OutboundWebhookPayload
): Promise<OutboundWebhookResult | OutboundWebhookError> {
  const jwt = await createOutboundJwt(secret, {
    runId: payload.meta.runId,
    assistantId: payload.meta.assistantId,
    assistantName: payload.meta.assistantName,
    tenantId: payload.meta.tenantId,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return { ok: false, error: `N8N webhook HTTP ${res.status}: ${bodyText}`, status: res.status }
    }

    const body: unknown = await res.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return { ok: false, error: 'N8N webhook retourneerde geen geldige JSON' }
    }

    const data = body as Record<string, unknown>
    const text = typeof data.text === 'string' ? data.text : typeof data.response === 'string' ? data.response : ''

    if (!text) {
      return { ok: false, error: 'N8N webhook retourneerde geen "text" of "response" veld' }
    }

    return { ok: true, text, meta: data.meta as Record<string, unknown> | undefined }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'N8N webhook timeout na 30s' }
    }
    return { ok: false, error: `N8N webhook request mislukt: ${err instanceof Error ? err.message : String(err)}` }
  }
}
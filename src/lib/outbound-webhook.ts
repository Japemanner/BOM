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
  message: string
  history: { role: 'user' | 'assistant'; content: string }[]
  assistantId: string
  assistantName: string
  tenantId: string
  tenantName: string
  userId: string
  userName: string
  /** Format: {tenantId}-{runId}. Beide zijn UUIDs, elk 36 tekens. */
  traceId: string
  timestamp: string
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
 * Fire-and-forget variant: stuur bericht naar N8N zonder op antwoord te wachten.
 * N8N belt later terug via POST /api/chat/callback.
 * Timeout: 10s (N8N moet de request meteen acken, niet wachten op flow resultaat).
 */
export async function sendOutboundWebhook(
  webhookUrl: string,
  secret: string,
  payload: OutboundWebhookPayload
): Promise<void> {
  const jwt = await createOutboundJwt(secret, {
    runId: payload.traceId.slice(37),
    assistantId: payload.assistantId,
    assistantName: payload.assistantName,
    tenantId: payload.tenantId,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

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
      throw new Error(`N8N webhook HTTP ${res.status}`)
    }
    // Alles OK — we negeren de body; N8N belt later terug.
  } catch (err) {
    clearTimeout(timeoutId)
    throw err instanceof Error ? err : new Error(String(err))
  }
}

export interface RagWebhookPayload {
  documentId: string
  s3Key: string
  filename: string
  tenantId: string
  assistantId: string
  assistantName: string
  userId: string
  timestamp: string
}

/**
 * Roep een N8N webhook aan voor RAG document upload.
 * BOM stuurt metadata, N8N downloadt file van S3 en vectoriseert.
 * Timeout: 10s (fire-and-forget).
 */
export async function sendRagWebhook(
  webhookUrl: string,
  secret: string,
  payload: RagWebhookPayload
): Promise<void> {
  const jwt = await createOutboundJwt(secret, {
    runId: payload.documentId,
    assistantId: payload.assistantId,
    assistantName: payload.assistantName,
    tenantId: payload.tenantId,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

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
      throw new Error(`N8N webhook HTTP ${res.status}`)
    }
  } catch (err) {
    clearTimeout(timeoutId)
    throw err instanceof Error ? err : new Error(String(err))
  }
}

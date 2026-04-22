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
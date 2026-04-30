import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { ragDocuments, assistants, knowledgeSources } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { jwtVerify } from 'jose'

const bodySchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(['indexed', 'failed']),
  error: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  let step = 'init'
  try {
    step = 'parse-body'
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { documentId, status: newStatus, error: errorMsg, meta } = parsed.data

    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        assistantId: ragDocuments.assistantId,
        knowledgeSourceId: ragDocuments.knowledgeSourceId,
        status: ragDocuments.status,
        tenantId: ragDocuments.tenantId,
        s3Key: ragDocuments.s3Key,
        metadata: ragDocuments.metadata,
      })
      .from(ragDocuments)
      .where(eq(ragDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    if (doc.status !== 'uploaded' && doc.status !== 'processing') {
      return NextResponse.json(
        { error: 'Document heeft onverwachte status', status: doc.status },
        { status: 409 }
      )
    }

    // Resolve webhook token from assistant or knowledge source
    let webhookTokenEncrypted: string | null = null

    if (doc.assistantId) {
      const [assistant] = await db
        .select({ webhookTokenEncrypted: assistants.webhookTokenEncrypted })
        .from(assistants)
        .where(eq(assistants.id, doc.assistantId))
        .limit(1)
      webhookTokenEncrypted = assistant?.webhookTokenEncrypted ?? null
    } else if (doc.knowledgeSourceId) {
      const [ks] = await db
        .select({ config: knowledgeSources.config })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, doc.knowledgeSourceId))
        .limit(1)
      const cfg = ks?.config as { webhookTokenEncrypted?: string } | null
      webhookTokenEncrypted = cfg?.webhookTokenEncrypted ?? null
    }

    if (!webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Bron heeft geen webhook secret geconfigureerd' },
        { status: 500 }
      )
    }

    step = 'validate-jwt'
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header ontbreekt' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    let secret: string
    try {
      secret = decrypt(webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    try {
      const { payload: jwtPayload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { issuer: 'bom', audience: 'n8n', clockTolerance: 60 }
      )
      if (jwtPayload.runId !== documentId) {
        return NextResponse.json({ error: 'JWT runId mismatch' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Ongeldige of expired JWT' }, { status: 401 })
    }

    step = 'update-status'
    const existingMeta = (doc.metadata ?? {}) as Record<string, unknown>

    if (newStatus === 'indexed') {
      await db
        .update(ragDocuments)
        .set({
          status: 'indexed',
          processedAt: new Date(),
          metadata: { ...existingMeta, ...(meta ?? {}) },
        })
        .where(eq(ragDocuments.id, documentId))

      // Update knowledge source status and count if applicable
      if (doc.knowledgeSourceId) {
        await db
          .update(knowledgeSources)
          .set({ status: 'ready', updatedAt: new Date(), documentCount: 1 })
          .where(and(
            eq(knowledgeSources.id, doc.knowledgeSourceId),
            eq(knowledgeSources.status, 'processing'),
          ))
      }
    } else {
      await db
        .update(ragDocuments)
        .set({
          status: 'failed',
          errorMessage: errorMsg ?? 'Onbekende fout',
          metadata: { ...existingMeta, ...(meta ?? {}) },
        })
        .where(eq(ragDocuments.id, documentId))

      if (doc.knowledgeSourceId) {
        await db
          .update(knowledgeSources)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(knowledgeSources.id, doc.knowledgeSourceId))
      }
    }

    return NextResponse.json({ ok: true, documentId, status: newStatus })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Interne fout bij RAG callback stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

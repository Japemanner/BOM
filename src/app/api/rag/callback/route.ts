import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { ragDocuments, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
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

    // ── Haal document + assistant op ────────────────────────────────
    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        assistantId: ragDocuments.assistantId,
        status: ragDocuments.status,
        tenantId: ragDocuments.tenantId,
        s3Key: ragDocuments.s3Key,
        webhookTokenEncrypted: assistants.webhookTokenEncrypted,
      })
      .from(ragDocuments)
      .innerJoin(assistants, eq(ragDocuments.assistantId, assistants.id))
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

    if (!doc.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook secret geconfigureerd' },
        { status: 500 }
      )
    }

    // ── Valideer JWT ──────────────────────────────────────────────────
    step = 'validate-jwt'
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header ontbreekt' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    let secret: string
    try {
      secret = decrypt(doc.webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    try {
      const { payload: jwtPayload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { issuer: 'bom', audience: 'n8n', clockTolerance: 60 }
      )
      // Extra beveiliging: documentId in JWT claim moet matchen met body
      if (jwtPayload.runId !== documentId) {
        return NextResponse.json({ error: 'JWT runId mismatch' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Ongeldige of expired JWT' }, { status: 401 })
    }

    // ── Update document status ────────────────────────────────────────
    step = 'update-status'
    if (newStatus === 'indexed') {
      await db
        .update(ragDocuments)
        .set({
          status: 'indexed',
          processedAt: new Date(),
          metadata: { ...(meta ?? {}) },
        })
        .where(eq(ragDocuments.id, documentId))
    } else {
      await db
        .update(ragDocuments)
        .set({
          status: 'failed',
          errorMessage: errorMsg ?? 'Onbekende fout',
          metadata: { ...(meta ?? {}) },
        })
        .where(eq(ragDocuments.id, documentId))
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

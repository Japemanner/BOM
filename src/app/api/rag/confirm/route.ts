import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, ragDocuments } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { sendRagWebhook } from '@/lib/outbound-webhook'
import { decrypt } from '@/lib/crypto'

const bodySchema = z.object({
  documentId: z.string().uuid(),
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
    const { documentId } = parsed.data

    // ── Haal document + assistant op (tenant isolatie) ──────────────
    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        tenantId: ragDocuments.tenantId,
        assistantId: ragDocuments.assistantId,
        filename: ragDocuments.filename,
        s3Key: ragDocuments.s3Key,
        status: ragDocuments.status,
        runInput: ragDocuments.metadata,
      })
      .from(ragDocuments)
      .where(eq(ragDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    if (doc.status !== 'uploaded') {
      return NextResponse.json(
        { error: 'Document heeft onverwachte status', status: doc.status },
        { status: 409 }
      )
    }

    // ── Haal assistant webhook config op ────────────────────────────
    step = 'fetch-assistant'
    const [assistant] = await db
      .select({
        id: assistants.id,
        name: assistants.name,
        tenantId: assistants.tenantId,
        webhookUrl: assistants.webhookUrl,
        webhookTokenEncrypted: assistants.webhookTokenEncrypted,
      })
      .from(assistants)
      .where(eq(assistants.id, doc.assistantId))
      .limit(1)

    if (!assistant) {
      return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
    }

    if (!assistant.webhookUrl || !assistant.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook geconfigureerd' },
        { status: 400 }
      )
    }

    // ── Decrypt secret ────────────────────────────────────────────────
    step = 'decrypt-secret'
    let secret: string
    try {
      secret = decrypt(assistant.webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    // ── Update status naar processing ────────────────────────────────
    step = 'update-status'
    await db
      .update(ragDocuments)
      .set({ status: 'processing' })
      .where(eq(ragDocuments.id, documentId))

    // ── Triggereer N8N RAG webhook (fire-and-forget) ──────────────
    step = 'trigger-n8n'
    const input = doc.runInput as { uploadedBy?: string } ?? {}
    await sendRagWebhook(assistant.webhookUrl, secret, {
      documentId,
      s3Key: doc.s3Key,
      filename: doc.filename,
      tenantId: doc.tenantId,
      assistantId: doc.assistantId,
      userId: input.uploadedBy ?? 'unknown',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, documentId, status: 'processing' })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)

    // Best effort: markeer als failed
    try {
      const rawBody: unknown = await request.json().catch(() => null)
      const { documentId } = rawBody as { documentId?: string } ?? {}
      if (documentId) {
        await db
          .update(ragDocuments)
          .set({ status: 'failed', errorMessage: errMsg })
          .where(eq(ragDocuments.id, documentId))
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      { error: 'Interne fout bij RAG confirm stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

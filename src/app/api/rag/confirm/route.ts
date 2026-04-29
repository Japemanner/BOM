import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, ragDocuments } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sendRagWebhook } from '@/lib/outbound-webhook'
import { decrypt } from '@/lib/crypto'
import { deleteS3Object } from '@/lib/s3'
import { auth } from '@/lib/auth'
import { canDo } from '@/lib/permissions'
import { headers } from 'next/headers'

const bodySchema = z.object({
  documentId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  let step = 'init'
  let documentId = '' // scope voor catch-block
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    step = 'auth'
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }
    const userId = session.user.id

    step = 'parse-body'
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    documentId = parsed.data.documentId

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
        assistantName: assistants.name,
        webhookUrl: assistants.webhookUrl,
        webhookTokenEncrypted: assistants.webhookTokenEncrypted,
      })
      .from(ragDocuments)
      .innerJoin(assistants, eq(ragDocuments.assistantId, assistants.id))
      .where(eq(ragDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    // ── RBAC ──────────────────────────────────────────────────────────
    step = 'rbac'
    if (!await canDo(userId, doc.tenantId, 'assistants', 'read')) {
      return NextResponse.json({ error: 'Geen toegang tot dit document' }, { status: 403 })
    }

    if (doc.status !== 'uploaded') {
      return NextResponse.json(
        { error: 'Document heeft onverwachte status', status: doc.status },
        { status: 409 }
      )
    }

    if (!doc.webhookUrl || !doc.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook geconfigureerd' },
        { status: 400 }
      )
    }

    // ── Decrypt secret ────────────────────────────────────────────────
    step = 'decrypt-secret'
    let secret: string
    try {
      secret = decrypt(doc.webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    // ── Idempotentie: atomair status naar processing zetten ────────
    // Alleen updaten als status nog 'uploaded' is — voorkomt dubbele N8N triggers
    step = 'lock-status'
    const [locked] = await db
      .update(ragDocuments)
      .set({ status: 'processing' })
      .where(and(
        eq(ragDocuments.id, documentId),
        eq(ragDocuments.status, 'uploaded')
      ))
      .returning({ id: ragDocuments.id })

    if (!locked) {
      // Race condition: iemand anders heeft al confirm aangeroepen
      return NextResponse.json(
        { error: 'Document wordt al verwerkt', status: 'processing' },
        { status: 409 }
      )
    }

    // ── Triggereer N8N RAG webhook (fire-and-forget) ──────────────
    step = 'trigger-n8n'
    const input = doc.runInput as { uploadedBy?: string } ?? {}
    try {
      await sendRagWebhook(doc.webhookUrl, secret, {
        documentId,
        s3Key: doc.s3Key,
        filename: doc.filename,
        tenantId: doc.tenantId,
        assistantId: doc.assistantId,
        assistantName: doc.assistantName,
        userId: input.uploadedBy ?? 'unknown',
        timestamp: new Date().toISOString(),
      })
    } catch (sendErr: unknown) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr)
      // Cleanup: markeer als failed en probeer S3 object te verwijderen
      await db
        .update(ragDocuments)
        .set({ status: 'failed', errorMessage: `N8N trigger mislukt: ${errMsg}` })
        .where(eq(ragDocuments.id, documentId))
      await deleteS3Object(doc.s3Key)
      return NextResponse.json(
        { error: `N8N RAG webhook trigger mislukt: ${errMsg}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, documentId, status: 'processing' })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)

    // Best effort: markeer als failed (gebruik documentId uit bovenliggende scope)
    if (documentId) {
      try {
        await db
          .update(ragDocuments)
          .set({ status: 'failed', errorMessage: errMsg })
          .where(eq(ragDocuments.id, documentId))
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { error: 'Interne fout bij RAG confirm stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

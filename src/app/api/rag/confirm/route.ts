import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, knowledgeSources, ragDocuments } from '@/db/schema/app'
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
  let documentId = ''
  try {
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

    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        tenantId: ragDocuments.tenantId,
        assistantId: ragDocuments.assistantId,
        knowledgeSourceId: ragDocuments.knowledgeSourceId,
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

    // Resolve webhook URL and secret from assistant or knowledge source
    let webhookUrl: string | null = null
    let webhookTokenEncrypted: string | null = null
    let assistantName: string | undefined
    let knowledgeSourceName: string | undefined

    if (doc.assistantId) {
      const [assistant] = await db
        .select({
          name: assistants.name,
          webhookUrl: assistants.webhookUrl,
          webhookTokenEncrypted: assistants.webhookTokenEncrypted,
        })
        .from(assistants)
        .where(eq(assistants.id, doc.assistantId))
        .limit(1)

      if (assistant) {
        webhookUrl = assistant.webhookUrl
        webhookTokenEncrypted = assistant.webhookTokenEncrypted
        assistantName = assistant.name
      }
    } else if (doc.knowledgeSourceId) {
      const [ks] = await db
        .select({
          name: knowledgeSources.name,
          config: knowledgeSources.config,
        })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, doc.knowledgeSourceId))
        .limit(1)

      if (ks) {
        const cfg = ks.config as { webhookUrl?: string; webhookTokenEncrypted?: string } | null
        knowledgeSourceName = ks.name
        webhookUrl = cfg?.webhookUrl ?? null
        webhookTokenEncrypted = cfg?.webhookTokenEncrypted ?? null
      }
    }

    if (!webhookUrl || !webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Geen webhook geconfigureerd voor deze bron' },
        { status: 400 }
      )
    }

    step = 'decrypt-secret'
    let secret: string
    try {
      secret = decrypt(webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

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
      return NextResponse.json(
        { error: 'Document wordt al verwerkt', status: 'processing' },
        { status: 409 }
      )
    }

    step = 'trigger-n8n'
    const input = doc.runInput as { uploadedBy?: string } ?? {}
    try {
      await sendRagWebhook(webhookUrl, secret, {
        documentId,
        s3Key: doc.s3Key,
        filename: doc.filename,
        tenantId: doc.tenantId,
        assistantId: doc.assistantId ?? undefined,
        assistantName,
        knowledgeSourceId: doc.knowledgeSourceId ?? undefined,
        knowledgeSourceName,
        userId: input.uploadedBy ?? 'unknown',
        timestamp: new Date().toISOString(),
      })
    } catch (sendErr: unknown) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr)
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

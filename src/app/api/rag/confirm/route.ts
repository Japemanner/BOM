import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, integrations, knowledgeSources, ragDocuments } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { sendRagWebhook } from '@/lib/outbound-webhook'
import { decrypt } from '@/lib/crypto'
import { deleteS3Object, getPresignedDownloadUrl } from '@/lib/s3'
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

    // Prioriteit: document-specifieke config eerst, globale RAG als laatste fallback
    let webhookUrl: string | null = null
    let webhookTokenEncrypted: string | null = null
    let assistantName: string | undefined
    let knowledgeSourceName: string | undefined
    let resolvedFrom: string | null = null

    // Tier 1: Knowledge source config (als document aan een KS hangt)
    if (!webhookUrl && doc.knowledgeSourceId) {
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
        if (cfg?.webhookUrl && cfg?.webhookTokenEncrypted) {
          webhookUrl = cfg.webhookUrl
          webhookTokenEncrypted = cfg.webhookTokenEncrypted
          resolvedFrom = 'knowledge_source'
        }
      }
    }

    // Tier 2: Assistant webhook (als document aan een assistant hangt)
    if (!webhookUrl && doc.assistantId) {
      const [assistant] = await db
        .select({
          name: assistants.name,
          webhookUrl: assistants.webhookUrl,
          webhookTokenEncrypted: assistants.webhookTokenEncrypted,
        })
        .from(assistants)
        .where(eq(assistants.id, doc.assistantId))
        .limit(1)

      if (assistant && assistant.webhookUrl && assistant.webhookTokenEncrypted) {
        webhookUrl = assistant.webhookUrl
        webhookTokenEncrypted = assistant.webhookTokenEncrypted
        assistantName = assistant.name
        resolvedFrom = 'assistant'
      }
    }

    // Tier 3: Globale RAG integratie (laatste fallback)
    if (!webhookUrl) {
      const [globalRag] = await db
        .select({ config: integrations.config })
        .from(integrations)
        .where(and(eq(integrations.tenantId, doc.tenantId), eq(integrations.type, 'rag'), eq(integrations.status, 'active')))
        .limit(1)

      if (globalRag) {
        const cfg = globalRag.config as { webhookUrl?: string; webhookTokenEncrypted?: string } | null
        if (cfg?.webhookUrl && cfg?.webhookTokenEncrypted) {
          webhookUrl = cfg.webhookUrl
          webhookTokenEncrypted = cfg.webhookTokenEncrypted
          resolvedFrom = 'global_rag_integration'
        }
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

    step = 'download-url'
    const downloadUrl = await getPresignedDownloadUrl(doc.s3Key, 3600)

    step = 'trigger-n8n'
    const input = doc.runInput as { uploadedBy?: string } ?? {}
    try {
      await sendRagWebhook(webhookUrl, secret, {
        documentId,
        s3Key: doc.s3Key,
        downloadUrl,
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
      console.error(`[RAG-WEBHOOK-FAIL] resolvedFrom=${resolvedFrom} url=${webhookUrl} error=${errMsg}`)
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

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, integrations, knowledgeSources, ragDocuments } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { sendRagWebhook } from '@/lib/outbound-webhook'
import { decrypt } from '@/lib/crypto'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  let step = 'init'
  try {
    const ctx = await getSessionContext()
    if (ctx instanceof NextResponse) return ctx
    const { userId, tenantId } = ctx

    if (!await canDo(userId, tenantId, 'knowledge_sources', 'update')) {
      return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
    }

    const { id: ksId, docId } = await params

    step = 'verify-source'
    const [source] = await db
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.id, ksId), eq(knowledgeSources.tenantId, tenantId)))
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Kennisbron niet gevonden' }, { status: 404 })
    }

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
        metadata: ragDocuments.metadata,
      })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.id, docId),
          eq(ragDocuments.knowledgeSourceId, ksId),
          eq(ragDocuments.tenantId, tenantId),
        )
      )
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    if (doc.status !== 'indexed') {
      return NextResponse.json(
        { error: 'Alleen geindexeerde documenten kunnen verwijderd worden', status: doc.status },
        { status: 409 }
      )
    }

    // Lock-status naar 'processing' — N8N belt terug met status: 'deleted' na vector cleanup
    step = 'lock-status'
    const [locked] = await db
      .update(ragDocuments)
      .set({ status: 'processing' })
      .where(and(
        eq(ragDocuments.id, docId),
        eq(ragDocuments.status, 'indexed'),
      ))
      .returning({ id: ragDocuments.id })

    if (!locked) {
      return NextResponse.json({ error: 'Document wordt al verwerkt' }, { status: 409 })
    }

    // Resolve webhook config (3-tier, zelfde als confirm)
    step = 'resolve-webhook'
    let webhookUrl: string | null = null
    let webhookTokenEncrypted: string | null = null
    let assistantName: string | undefined
    let knowledgeSourceName: string | undefined

    if (doc.knowledgeSourceId) {
      const [ks] = await db
        .select({ name: knowledgeSources.name, config: knowledgeSources.config })
        .from(knowledgeSources)
        .where(eq(knowledgeSources.id, doc.knowledgeSourceId))
        .limit(1)

      if (ks) {
        const cfg = ks.config as { webhookUrl?: string; webhookTokenEncrypted?: string } | null
        knowledgeSourceName = ks.name
        if (cfg?.webhookUrl && cfg?.webhookTokenEncrypted) {
          webhookUrl = cfg.webhookUrl
          webhookTokenEncrypted = cfg.webhookTokenEncrypted
        }
      }
    }

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
      }
    }

    if (!webhookUrl) {
      const [globalRag] = await db
        .select({ config: integrations.config })
        .from(integrations)
        .where(and(
          eq(integrations.tenantId, doc.tenantId),
          eq(integrations.type, 'rag'),
          eq(integrations.status, 'active'),
        ))
        .limit(1)

      if (globalRag) {
        const cfg = globalRag.config as { webhookUrl?: string; webhookTokenEncrypted?: string } | null
        if (cfg?.webhookUrl && cfg?.webhookTokenEncrypted) {
          webhookUrl = cfg.webhookUrl
          webhookTokenEncrypted = cfg.webhookTokenEncrypted
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
      await db.update(ragDocuments).set({ status: 'indexed' }).where(eq(ragDocuments.id, docId))
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    step = 'trigger-n8n-delete'
    try {
      await sendRagWebhook(webhookUrl, secret, {
        action: 'delete',
        documentId: doc.id,
        s3Key: doc.s3Key,
        downloadUrl: '',
        filename: doc.filename,
        tenantId: doc.tenantId,
        assistantId: doc.assistantId ?? undefined,
        assistantName,
        knowledgeSourceId: doc.knowledgeSourceId ?? undefined,
        knowledgeSourceName,
        userId,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Webhook mislukt → revert status
      await db
        .update(ragDocuments)
        .set({ status: 'indexed' })
        .where(eq(ragDocuments.id, docId))
      return NextResponse.json({ error: 'N8N webhook trigger mislukt' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, documentId: docId, status: 'processing' }, { status: 202 })
  } catch (error) {
    console.error(`[knowledge-sources/[id]/documents/[docId] DELETE step=${step}]`, error)
    return NextResponse.json({ error: 'Interne fout bij stap: ' + step }, { status: 500 })
  }
}

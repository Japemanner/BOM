import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantTenants, assistantRuns, assistantKnowledgeSources, knowledgeSources, ragDocuments } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { users } from '@/db/schema/auth'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { sendOutboundWebhook } from '@/lib/outbound-webhook'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .default([]),
})

export async function POST(request: NextRequest) {
  let step = 'init'
  let runId: string | undefined
  let errorDetail: string | undefined

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    step = 'auth'
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }
    const userId = session.user.id

    // ── Body validatie ────────────────────────────────────────────────
    step = 'parse-body'
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { assistantId, message, history } = parsed.data

    // ── Haal assistent + eerste tenant op ───────────────────────────
    step = 'fetch-assistant'
    const [assistant] = await db
      .select({
        id: assistants.id,
        name: assistants.name,
        webhookUrl: assistants.webhookUrl,
        webhookTokenEncrypted: assistants.webhookTokenEncrypted,
      })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1)

    if (!assistant) {
      return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
    }

    // ── Haal eerste tenant op voor deze assistent ──────────────────────
    step = 'fetch-tenant'
    const [at] = await db
      .select({ tenantId: assistantTenants.tenantId })
      .from(assistantTenants)
      .where(eq(assistantTenants.assistantId, assistantId))
      .limit(1)

    if (!at) {
      return NextResponse.json({ error: 'Assistent niet gekoppeld aan een tenant' }, { status: 500 })
    }

    const tenantId = at.tenantId

    // ── Webhook config check ─────────────────────────────────────────
    step = 'webhook-config-check'
    if (!assistant.webhookUrl || !assistant.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook geconfigureerd. Configureer een webhook in de instellingen.' },
        { status: 400 }
      )
    }

    // ── Maak run-record aan in één keer (async pattern) ─────────────
    step = 'insert-run'
    const [run] = await db
      .insert(assistantRuns)
      .values({
        assistantId,
        status: 'running',
        input: { message, history, historyLength: history.length, userId, tenantId },
      })
      .returning({ id: assistantRuns.id })

    runId = run?.id
    if (!runId) {
      return NextResponse.json({ error: 'Fout bij aanmaken run' }, { status: 500 })
    }

    const traceId = `${tenantId}-${runId}`

    // ── Haal namen op voor payload ────────────────────────────────────
    step = 'fetch-names'
    let tenantName = 'Onbekend'
    try {
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1)
      if (tenant?.name) tenantName = tenant.name
    } catch {
      // Tenant naam niet kritisch
    }

    let userName = session.user?.name ?? 'Onbekend'
    if (userName === 'Onbekend' || !userName) {
      try {
        const [dbUser] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        if (dbUser?.name) userName = dbUser.name
      } catch {
        // Naam ophalen mislukt
      }
    }

    // ── Haal gekoppelde kennisbron-documenten op ────────────────────
    step = 'fetch-knowledge-source-docs'
    let knowledgeSourceDocuments: Array<{
      knowledgeSourceId: string
      knowledgeSourceName: string
      filenames: string[]
    }> = []
    try {
      const ksRows = await db
        .select({
          knowledgeSourceId: knowledgeSources.id,
          knowledgeSourceName: knowledgeSources.name,
          filename: ragDocuments.filename,
        })
        .from(assistantKnowledgeSources)
        .innerJoin(knowledgeSources, eq(assistantKnowledgeSources.knowledgeSourceId, knowledgeSources.id))
        .leftJoin(ragDocuments, and(
          eq(ragDocuments.knowledgeSourceId, knowledgeSources.id),
          eq(ragDocuments.status, 'indexed')
        ))
        .where(eq(assistantKnowledgeSources.assistantId, assistantId))

      const grouped = new Map<string, { knowledgeSourceId: string; knowledgeSourceName: string; filenames: string[] }>()
      for (const row of ksRows) {
        if (!grouped.has(row.knowledgeSourceId)) {
          grouped.set(row.knowledgeSourceId, {
            knowledgeSourceId: row.knowledgeSourceId,
            knowledgeSourceName: row.knowledgeSourceName,
            filenames: [],
          })
        }
        if (row.filename) grouped.get(row.knowledgeSourceId)!.filenames.push(row.filename)
      }
      knowledgeSourceDocuments = [...grouped.values()]
    } catch {
      // Niet kritisch — ga door zonder document-informatie
    }

    // ── Decrypt secret ────────────────────────────────────────────────
    step = 'decrypt-webhook-secret'
    let secret: string
    try {
      secret = decrypt(assistant.webhookTokenEncrypted)
    } catch (decryptErr: unknown) {
      errorDetail = `Decrypt failed: ${decryptErr instanceof Error ? decryptErr.message : String(decryptErr)}`
      await db
        .update(assistantRuns)
        .set({ status: 'failed', output: { error: errorDetail } })
        .where(eq(assistantRuns.id, runId))
      return NextResponse.json(
        { error: 'Webhook secret decryptie mislukt. Controleer of ENCRYPTION_KEY correct is ingesteld en het token geldig is opgeslagen.', detail: errorDetail },
        { status: 500 }
      )
    }

    // ── Stuur bericht naar N8N (fire-and-forget) ──────────────────────
    step = 'send-outbound-webhook'
    const timestamp = new Date().toISOString()
    try {
      await sendOutboundWebhook(assistant.webhookUrl, secret, {
        message,
        history,
        assistantId,
        assistantName: assistant.name,
        tenantId: tenantId,
        tenantName,
        userId,
        userName,
        traceId,
        timestamp,
        knowledgeSourceDocuments,
      })
    } catch (sendErr: unknown) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr)
      await db
        .update(assistantRuns)
        .set({ status: 'failed', output: { error: errMsg } })
        .where(eq(assistantRuns.id, runId))
      return NextResponse.json({ error: `N8N webhook versturen mislukt: ${errMsg}` }, { status: 502 })
    }

    // ── Return 202 Accepted ─ client gaat pollen ─────────────────────
    return NextResponse.json({ runId, status: 'running' }, { status: 202 })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    errorDetail = errMsg

    // Probeer run als failed te markeren (best effort)
    if (runId) {
      try {
        await db
          .update(assistantRuns)
          .set({ status: 'failed', output: { error: errMsg } })
          .where(eq(assistantRuns.id, runId))
      } catch {
        // Ignore DB errors in catch
      }
    }

    return NextResponse.json(
      { error: 'Interne fout bij stap: ' + step, detail: errorDetail },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantRuns } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { callOutboundWebhook } from '@/lib/outbound-webhook'
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

    // ── Haal assistent op ──────────────────────────────────────────
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
      .where(eq(assistants.id, assistantId))
      .limit(1)

    if (!assistant) {
      return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
    }

    // ── Tenant-isolatie ──────────────────────────────────────────────
    step = 'tenant-check'
    if (!assistant.tenantId) {
      return NextResponse.json({ error: 'Assistent heeft geen tenant' }, { status: 500 })
    }

    // ── Webhook config check ─────────────────────────────────────────
    step = 'webhook-config-check'
    if (!assistant.webhookUrl || !assistant.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook geconfigureerd. Configureer een webhook in de instellingen.' },
        { status: 400 }
      )
    }

    // ── Maak run-record aan voor tracking ────────────────────────────
    step = 'insert-run'
    // Backward-compatible: draai de migratie 0007 niet op productie,
    // dus insert alleen de kolommen die ALTIJD bestaan.
    const [run] = await db
      .insert(assistantRuns)
      .values({
        assistantId,
        status: 'running',
        input: { message, historyLength: history.length },
      })
      .returning({ id: assistantRuns.id })

    runId = run?.id
    if (!runId) {
      return NextResponse.json({ error: 'Fout bij aanmaken run' }, { status: 500 })
    }

    const traceId = `${assistant.tenantId}-${runId}`

    // ── Update run met userId / tenantId in JSON input ─────────────────
    step = 'update-run-meta'
    await db
      .update(assistantRuns)
      .set({
        input: {
          message,
          historyLength: history.length,
          userId,
          tenantId: assistant.tenantId,
        },
      })
      .where(eq(assistantRuns.id, runId))

    // ── Haal namen op voor payload ────────────────────────────────────
    step = 'fetch-names'
    let tenantName = 'Onbekend'
    try {
      const [tenant] = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, assistant.tenantId))
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

    // ── Roep N8N webhook aan ────────────────────────────────────────
    step = 'call-outbound-webhook'
    const timestamp = new Date().toISOString()
    const result = await callOutboundWebhook(assistant.webhookUrl, secret, {
      message,
      history,
      assistantId,
      assistantName: assistant.name,
      tenantId: assistant.tenantId,
      tenantName,
      userId,
      userName,
      traceId,
      timestamp,
    })

    if (!result.ok) {
      await db
        .update(assistantRuns)
        .set({ status: 'failed', output: { error: result.error } })
        .where(eq(assistantRuns.id, runId))
      return NextResponse.json({ error: `N8N webhook mislukt: ${result.error}` }, { status: 502 })
    }

    // ── Update run met succes ────────────────────────────────────────
    step = 'update-run-success'
    const messagesPayload = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
      { role: 'assistant', content: result.text },
    ]
    await db
      .update(assistantRuns)
      .set({
        status: 'success',
        output: { text: result.text, messages: messagesPayload },
      })
      .where(eq(assistantRuns.id, runId))

    return NextResponse.json({
      ok: true,
      text: result.text,
      runId,
    })
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

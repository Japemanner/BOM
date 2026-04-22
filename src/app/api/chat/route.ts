import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantRuns } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { callOutboundWebhook } from '@/lib/outbound-webhook'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { canDo } from '@/lib/permissions'

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  /** Optionele berichtengeschiedenis als context */
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
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }
    const userId = session.user.id

    // ── Body validatie ────────────────────────────────────────────────
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { assistantId, message, history } = parsed.data

    // ── Haal assistent op (tenant-isolatie) ──────────────────────────
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

    // ── Permissiecheck ────────────────────────────────────────────────
    const allowed = await canDo(userId, assistant.tenantId, 'assistant', 'read')
    if (!allowed) {
      return NextResponse.json({ error: 'Geen toegang tot deze assistent' }, { status: 403 })
    }

    // ─--Webhook config check ──────────────────────────────────────────
    if (!assistant.webhookUrl || !assistant.webhookTokenEncrypted) {
      return NextResponse.json(
        { error: 'Assistent heeft geen webhook geconfigureerd. Configureer een webhook in de instellingen.' },
        { status: 400 }
      )
    }

    // ── Maak run-record aan voor tracking ───────────────────────────────
    const [run] = await db
      .insert(assistantRuns)
      .values({
        assistantId,
        status: 'running',
        input: { message, historyLength: history.length },
      })
      .returning({ id: assistantRuns.id })

    const runId = run?.id ?? `tmp-${Date.now()}`

    // ── Decrypt secret ────────────────────────────────────────────────
    let secret: string
    try {
      secret = decrypt(assistant.webhookTokenEncrypted)
    } catch {
      await db
        .update(assistantRuns)
        .set({ status: 'failed', output: { error: 'Webhook secret decryptie mislukt' } })
        .where(eq(assistantRuns.id, runId))
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    // ── Roep N8N webhook aan ────────────────────────────────────────
    const result = await callOutboundWebhook(assistant.webhookUrl, secret, {
      message,
      history,
      meta: {
        assistantId,
        assistantName: assistant.name,
        tenantId: assistant.tenantId,
        runId,
        timestamp: new Date().toISOString(),
      },
    })

    if (!result.ok) {
      await db
        .update(assistantRuns)
        .set({ status: 'failed', output: { error: result.error } })
        .where(eq(assistantRuns.id, runId))
      return NextResponse.json({ error: `N8N webhook mislukt: ${result.error}` }, { status: 502 })
    }

    // ── Update run met succes ────────────────────────────────────────
    await db
      .update(assistantRuns)
      .set({ status: 'success', output: { text: result.text } })
      .where(eq(assistantRuns.id, runId))

    return NextResponse.json({
      ok: true,
      text: result.text,
      runId,
    })
  } catch (error) {
    console.error('[chat POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

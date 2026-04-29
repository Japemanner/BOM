import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns } from '@/db/schema/app'
import { assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { jwtVerify } from 'jose'
const bodySchema = z.object({
  runId: z.string().uuid(),
  text: z.string().min(1),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  let step = 'init'
  try {
    // ── Auth ──────────────────────────────────────────────────────────
    // Callback wordt aangeroepen door N8N, niet door browser.
    // JWT validatie volgt onderaan, na opzoeken van de run.
    step = 'parse-body'
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { runId, text, meta } = parsed.data

    // ── Haal run + assistant op (tenant isolatie) ─────────────────────
    step = 'fetch-run'
    const [run] = await db
      .select({
        id: assistantRuns.id,
        assistantId: assistantRuns.assistantId,
        status: assistantRuns.status,
        runInput: assistantRuns.input,
        tenantId: assistants.tenantId,
        webhookTokenEncrypted: assistants.webhookTokenEncrypted,
      })
      .from(assistantRuns)
      .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
      .where(eq(assistantRuns.id, runId))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
    }

    if (run.status !== 'running') {
      return NextResponse.json(
        { error: 'Run is niet meer actief', status: run.status },
        { status: 409 }
      )
    }

    if (!run.webhookTokenEncrypted) {
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
      secret = decrypt(run.webhookTokenEncrypted)
    } catch {
      return NextResponse.json({ error: 'Webhook secret decryptie mislukt' }, { status: 500 })
    }

    try {
      const { payload: jwtPayload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        {
          issuer: 'bom',
          audience: 'n8n',
          clockTolerance: 60,
        }
      )
      // Extra beveiliging: runId in JWT claim moet matchen met body
      if (jwtPayload.runId !== runId) {
        return NextResponse.json({ error: 'JWT runId mismatch' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Ongeldige of expired JWT' }, { status: 401 })
    }

    // ── Bouw messages array vanuit input ─────────────────────────────
    step = 'build-messages'
    const input = (run.runInput as { message?: string; history?: { role: string; content: string }[] }) ?? {}
    const messagesPayload = [
      ...(input.history ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: input.message ?? '' },
      { role: 'assistant', content: text },
    ]

    // ── Update run met succes ────────────────────────────────────────
    step = 'update-run-success'
    await db
      .update(assistantRuns)
      .set({
        status: 'success',
        output: {
          text,
          messages: messagesPayload,
          ...meta,
        },
      })
      .where(eq(assistantRuns.id, runId))

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Interne fout bij callback stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

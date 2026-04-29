import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { decrypt } from '@/lib/crypto'
import { createOutboundJwt } from '@/lib/outbound-webhook'
const bodySchema = z.object({
  assistantId: z.string().uuid(),
  status: z
    .enum(['pending', 'running', 'success', 'failed'] as const)
    .default('success'),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.string().optional(),
  durationMs: z.number().int().positive().optional(),
})

async function fireOutboundWebhook(
  webhookUrl: string,
  webhookTokenEncrypted: string,
  claims: {
    runId: string
    assistantId: string
    assistantName: string
    tenantId: string
    output: string
    timestamp: string
  }
): Promise<void> {
  try {
    const secret = decrypt(webhookTokenEncrypted)
    const jwt = await createOutboundJwt(secret, {
      runId: claims.runId,
      assistantId: claims.assistantId,
      assistantName: claims.assistantName,
      tenantId: claims.tenantId,
    })
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(claims),
    })
  } catch (err) {
    console.error('[assistant-runs outbound webhook mislukt]', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { assistantId, status, input, output, durationMs } = parsed.data

    const runs = await db
      .insert(assistantRuns)
      .values({
        assistantId,
        status,
        input,
        output: output ? { text: output } : {},
        durationMs,
      })
      .returning()

    const run = runs[0]
    if (!run) {
      return NextResponse.json({ error: 'Fout bij aanmaken run' }, { status: 500 })
    }

    if (output) {
      const [assistant] = await db
        .select({
          name: assistants.name,
          webhookUrl: assistants.webhookUrl,
          webhookTokenEncrypted: assistants.webhookTokenEncrypted,
          tenantId: assistants.tenantId,
        })
        .from(assistants)
        .where(eq(assistants.id, assistantId))
        .limit(1)

      if (assistant?.webhookUrl && assistant.webhookTokenEncrypted) {
        void fireOutboundWebhook(assistant.webhookUrl, assistant.webhookTokenEncrypted, {
          runId: run.id,
          assistantId,
          assistantName: assistant.name,
          tenantId: assistant.tenantId,
          output,
          timestamp: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json(run, { status: 201 })
  } catch (error) {
    console.error('[assistant-runs POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
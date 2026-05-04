import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { integrations } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { encrypt } from '@/lib/crypto'

const upsertSchema = z.object({
  type: z.literal('rag'),
  config: z.object({
    webhookUrl: z.string().url(),
    webhookToken: z.string().min(8),
  }),
})

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'integrations', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const rows = await db
      .select({
        id: integrations.id,
        tenantId: integrations.tenantId,
        type: integrations.type,
        status: integrations.status,
        config: integrations.config,
        lastCheckedAt: integrations.lastCheckedAt,
      })
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId))

    const safe = rows.map((r) => {
      const cfg = r.config as Record<string, unknown>
      return {
        ...r,
        config: {
          webhookUrl: cfg.webhookUrl ?? null,
          hasToken: !!cfg.webhookTokenEncrypted,
        },
      }
    })

    return NextResponse.json(safe)
  } catch (error) {
    console.error('[integrations GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'integrations', 'update')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { type, config } = parsed.data
    const webhookTokenEncrypted = encrypt(config.webhookToken)

    const [existing] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, type)))
      .limit(1)

    let result
    if (existing) {
      const [updated] = await db
        .update(integrations)
        .set({
          config: { webhookUrl: config.webhookUrl, webhookTokenEncrypted },
          status: 'active',
          lastCheckedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning()
      result = updated
    } else {
      const [created] = await db
        .insert(integrations)
        .values({
          tenantId,
          type,
          status: 'active',
          config: { webhookUrl: config.webhookUrl, webhookTokenEncrypted },
          lastCheckedAt: new Date(),
        })
        .returning()
      result = created
    }

    if (!result) {
      return NextResponse.json({ error: 'Fout bij opslaan' }, { status: 500 })
    }

    const cfg = result.config as Record<string, unknown>
    return NextResponse.json({
      id: result.id,
      tenantId: result.tenantId,
      type: result.type,
      status: result.status,
      config: {
        webhookUrl: cfg.webhookUrl ?? null,
        hasToken: true,
      },
      lastCheckedAt: result.lastCheckedAt,
    })
  } catch (error) {
    console.error('[integrations POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

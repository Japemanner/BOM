import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'webhooks', 'manage')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const tokens = await db
      .select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        assistantId: webhookTokens.assistantId,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      })
      .from(webhookTokens)
      .where(eq(webhookTokens.tenantId, tenantId))
      .orderBy(webhookTokens.createdAt)

    return NextResponse.json(tokens)
  } catch (error) {
    console.error('[webhooks/tokens GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  assistantId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'webhooks', 'manage')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = createTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { name, assistantId } = parsed.data

    const plaintext = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plaintext).digest('hex')

    const [token] = await db
      .insert(webhookTokens)
      .values({
        tenantId,
        name,
        tokenHash,
        assistantId: assistantId ?? null,
      })
      .returning({
        id: webhookTokens.id,
        name: webhookTokens.name,
        assistantId: webhookTokens.assistantId,
        createdAt: webhookTokens.createdAt,
      })

    return NextResponse.json({ ...token, token: plaintext }, { status: 201 })
  } catch (error) {
    console.error('[webhooks/tokens POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
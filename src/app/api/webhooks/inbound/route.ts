// src/app/api/webhooks/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens, reviewItems } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { z } from 'zod'

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Ongeautoriseerd' }, { status: 401 })
  }
  const plaintext = auth.slice(7)
  const tokenHash = createHash('sha256').update(plaintext).digest('hex')

  let tokenRecord: { id: string; tenantId: string } | undefined
  try {
    const [found] = await db
      .select({ id: webhookTokens.id, tenantId: webhookTokens.tenantId })
      .from(webhookTokens)
      .where(eq(webhookTokens.tokenHash, tokenHash))
      .limit(1)
    tokenRecord = found
  } catch (error) {
    console.error('[webhooks/inbound DB]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }

  if (!tokenRecord) {
    return NextResponse.json({ error: 'Ongeldig token' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ongeldige invoer', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { assistantId, title, description, priority } = parsed.data

  try {
    const items = await db
      .insert(reviewItems)
      .values({ assistantId, tenantId: tokenRecord.tenantId, title, description, priority })
      .returning({ id: reviewItems.id })

    if (!items[0]) {
      return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
    }

    await db
      .update(webhookTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhookTokens.id, tokenRecord.id))

    return NextResponse.json({ id: items[0].id, ok: true }, { status: 201 })
  } catch (error) {
    console.error('[webhooks/inbound INSERT]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

// src/app/api/webhooks/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const tokens = await db
      .select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      })
      .from(webhookTokens)
      .where(eq(webhookTokens.tenantId, DEMO_TENANT_ID))
      .orderBy(webhookTokens.createdAt)

    return NextResponse.json(tokens)
  } catch (error) {
    console.error('[webhooks/tokens GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null)
    const parsed = createTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const plaintext = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(plaintext).digest('hex')

    const [token] = await db
      .insert(webhookTokens)
      .values({ tenantId: DEMO_TENANT_ID, name: parsed.data.name, tokenHash })
      .returning({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
      })

    return NextResponse.json({ ...token, token: plaintext }, { status: 201 })
  } catch (error) {
    console.error('[webhooks/tokens POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

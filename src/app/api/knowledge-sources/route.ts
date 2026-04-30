import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources } from '@/db/schema/app'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const result = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.tenantId, tenantId))
      .orderBy(desc(knowledgeSources.createdAt))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[knowledge-sources GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
})

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'create')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { name, description } = parsed.data

    const [created] = await db
      .insert(knowledgeSources)
      .values({
        tenantId,
        name,
        description,
        status: 'empty',
        documentCount: 0,
        config: {},
      })
      .returning()

    if (!created) {
      return NextResponse.json({ error: 'Fout bij aanmaken' }, { status: 500 })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[knowledge-sources POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

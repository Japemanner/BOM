import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources, assistants, assistantKnowledgeSources } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params

  const [source] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
    .limit(1)

  if (!source) {
    return NextResponse.json({ error: 'Kennisbron niet gevonden' }, { status: 404 })
  }

  try {
    const result = await db
      .select({
        id: assistants.id,
        name: assistants.name,
        type: assistants.type,
        createdAt: assistantKnowledgeSources.createdAt,
      })
      .from(assistantKnowledgeSources)
      .innerJoin(assistants, eq(assistantKnowledgeSources.assistantId, assistants.id))
      .where(
        and(
          eq(assistantKnowledgeSources.knowledgeSourceId, id),
          eq(assistants.tenantId, tenantId),
        )
      )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[knowledge-sources/[id]/assistants GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

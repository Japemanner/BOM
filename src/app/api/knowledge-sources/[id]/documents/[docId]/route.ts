import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources, ragDocuments } from '@/db/schema/app'
import { and, eq, sql } from 'drizzle-orm'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'update')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id, docId } = await params

  const [source] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
    .limit(1)

  if (!source) {
    return NextResponse.json({ error: 'Kennisbron niet gevonden' }, { status: 404 })
  }

  try {
    const [deleted] = await db
      .delete(ragDocuments)
      .where(
        and(
          eq(ragDocuments.id, docId),
          eq(ragDocuments.knowledgeSourceId, id),
          eq(ragDocuments.tenantId, tenantId),
        )
      )
      .returning({ id: ragDocuments.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    await db
      .update(knowledgeSources)
      .set({
        documentCount: sql`GREATEST(document_count - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, id))

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[knowledge-sources/[id]/documents/[docId] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

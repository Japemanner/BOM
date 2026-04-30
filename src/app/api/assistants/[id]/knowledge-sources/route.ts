import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantKnowledgeSources, knowledgeSources } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params

  const [assistant] = await db
    .select({ id: assistants.id })
    .from(assistants)
    .where(and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)))
    .limit(1)

  if (!assistant) {
    return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
  }

  try {
    const result = await db
      .select({
        id: knowledgeSources.id,
        name: knowledgeSources.name,
        description: knowledgeSources.description,
        status: knowledgeSources.status,
        documentCount: knowledgeSources.documentCount,
        createdAt: knowledgeSources.createdAt,
      })
      .from(assistantKnowledgeSources)
      .innerJoin(
        knowledgeSources,
        and(
          eq(assistantKnowledgeSources.knowledgeSourceId, knowledgeSources.id),
          eq(knowledgeSources.tenantId, tenantId),
        )
      )
      .where(eq(assistantKnowledgeSources.assistantId, id))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[assistants/[id]/knowledge-sources GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const patchSchema = z.object({
  knowledgeSourceIds: z.array(z.string().uuid()),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'update')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params

  const [assistant] = await db
    .select({ id: assistants.id })
    .from(assistants)
    .where(and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)))
    .limit(1)

  if (!assistant) {
    return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { knowledgeSourceIds } = parsed.data

    for (const ksId of knowledgeSourceIds) {
      const [ks] = await db
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(and(eq(knowledgeSources.id, ksId), eq(knowledgeSources.tenantId, tenantId)))
        .limit(1)

      if (!ks) {
        return NextResponse.json(
          { error: `Kennisbron ${ksId} niet gevonden` },
          { status: 400 }
        )
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(assistantKnowledgeSources)
        .where(eq(assistantKnowledgeSources.assistantId, id))

      if (knowledgeSourceIds.length > 0) {
        await tx.insert(assistantKnowledgeSources).values(
          knowledgeSourceIds.map((ksId) => ({
            assistantId: id,
            knowledgeSourceId: ksId,
          }))
        )
      }
    })

    const current = await db
      .select({
        id: knowledgeSources.id,
        name: knowledgeSources.name,
      })
      .from(assistantKnowledgeSources)
      .innerJoin(knowledgeSources, eq(assistantKnowledgeSources.knowledgeSourceId, knowledgeSources.id))
      .where(eq(assistantKnowledgeSources.assistantId, id))

    return NextResponse.json(current)
  } catch (error) {
    console.error('[assistants/[id]/knowledge-sources PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

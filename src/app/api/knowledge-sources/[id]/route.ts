import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources } from '@/db/schema/app'
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

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(source)
  } catch (error) {
    console.error('[knowledge-sources/[id] GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Geen velden om te updaten' })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'update')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const body: unknown = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: new Date(),
    }

    const [updated] = await db
      .update(knowledgeSources)
      .set(updateData)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[knowledge-sources/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'delete')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const [deleted] = await db
      .delete(knowledgeSources)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .returning({ id: knowledgeSources.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[knowledge-sources/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

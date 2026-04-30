import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources, ragDocuments } from '@/db/schema/app'
import { and, eq, desc } from 'drizzle-orm'
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

  const [source] = await db
    .select({ id: knowledgeSources.id })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
    .limit(1)

  if (!source) {
    return NextResponse.json({ error: 'Kennisbron niet gevonden' }, { status: 404 })
  }

  try {
    const documents = await db
      .select()
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.knowledgeSourceId, id),
          eq(ragDocuments.tenantId, tenantId)
        )
      )
      .orderBy(desc(ragDocuments.createdAt))

    return NextResponse.json(documents)
  } catch (error) {
    console.error('[knowledge-sources/[id]/documents GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const uploadBodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024),
})

export async function POST(
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

  const [source] = await db
    .select({ id: knowledgeSources.id, documentCount: knowledgeSources.documentCount })
    .from(knowledgeSources)
    .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
    .limit(1)

  if (!source) {
    return NextResponse.json({ error: 'Kennisbron niet gevonden' }, { status: 404 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = uploadBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { filename, contentType, fileSize } = parsed.data
    void fileSize

    const [doc] = await db
      .insert(ragDocuments)
      .values({
        tenantId,
        knowledgeSourceId: id,
        filename,
        s3Key: '',
        status: 'uploaded',
        metadata: { contentType, uploadedBy: userId },
      })
      .returning({ id: ragDocuments.id, knowledgeSourceId: ragDocuments.knowledgeSourceId })

    const documentId = doc?.id
    if (!documentId) {
      return NextResponse.json({ error: 'Fout bij aanmaken document' }, { status: 500 })
    }

    await db
      .update(knowledgeSources)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, id))

    return NextResponse.json(
      { documentId, knowledgeSourceId: id },
      { status: 201 }
    )
  } catch (error) {
    console.error('[knowledge-sources/[id]/documents POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { AssistantStatus } from '@/types'

// Admin endpoint — geen tenant-isolatie (admin ziet alle assistenten)
const patchSchema = z.object({
  status: z.enum([
    AssistantStatus.ACTIVE,
    AssistantStatus.PAUSED,
    AssistantStatus.ERROR,
  ]).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  type: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Geen velden om te updaten' })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const assistant = await db.query.assistants.findFirst({
      where: eq(assistants.id, id),
    })
    if (!assistant) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }
    return NextResponse.json(assistant)
  } catch (error) {
    console.error('[assistants/[id] GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const [updated] = await db
      .update(assistants)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(assistants.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[assistants/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [deleted] = await db
      .delete(assistants)
      .where(eq(assistants.id, id))
      .returning({ id: assistants.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[assistants/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { updateAssistantStatusSchema } from '@/lib/validations'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const assistant = await db.query.assistants.findFirst({
      where: and(
        eq(assistants.id, id),
        eq(assistants.tenantId, DEMO_TENANT_ID)
      ),
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
    const parsed = updateAssistantStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(assistants)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(
        and(eq(assistants.id, id), eq(assistants.tenantId, DEMO_TENANT_ID))
      )
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

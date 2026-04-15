import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { reviewItems } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { updateReviewStatusSchema } from '@/lib/validations'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body: unknown = await request.json()
    const parsed = updateReviewStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(reviewItems)
      .set({
        status: parsed.data.status,
        resolvedAt: new Date(),
      })
      .where(
        and(eq(reviewItems.id, id), eq(reviewItems.tenantId, DEMO_TENANT_ID))
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[review/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

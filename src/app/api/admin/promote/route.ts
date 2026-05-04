import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tenantMembers } from '@/db/schema/iam'
import { eq, and } from 'drizzle-orm'
import { getSessionContext } from '@/lib/session'

export async function POST() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  try {
    const [updated] = await db
      .update(tenantMembers)
      .set({ role: 'super_admin' })
      .where(
        and(
          eq(tenantMembers.userId, userId),
          eq(tenantMembers.tenantId, tenantId)
        )
      )
      .returning({ role: tenantMembers.role })

    if (!updated) {
      return NextResponse.json({ error: 'Geen lidmaatschap gevonden' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, role: updated.role })
  } catch (error) {
    console.error('[admin/promote]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

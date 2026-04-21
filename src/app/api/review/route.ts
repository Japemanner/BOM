import { NextResponse } from 'next/server'
import { db } from '@/db'
import { reviewItems } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { ReviewStatus, ReviewPriority } from '@/types'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

const priorityOrder: Record<string, number> = {
  [ReviewPriority.CRITICAL]: 0,
  [ReviewPriority.HIGH]: 1,
  [ReviewPriority.MEDIUM]: 2,
  [ReviewPriority.LOW]: 3,
}

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const items = await db.query.reviewItems.findMany({
      where: and(
        eq(reviewItems.tenantId, tenantId),
        eq(reviewItems.status, ReviewStatus.OPEN)
      ),
      orderBy: (r, { asc }) => [asc(r.createdAt)],
      limit: 50,
    })

    const sorted = [...items].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    )

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('[review GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { reviewItems } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { ReviewStatus, ReviewPriority } from '@/types'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

const priorityOrder: Record<ReviewPriority, number> = {
  [ReviewPriority.CRITICAL]: 0,
  [ReviewPriority.HIGH]: 1,
  [ReviewPriority.MEDIUM]: 2,
  [ReviewPriority.LOW]: 3,
}

export async function GET() {
  try {
    const items = await db.query.reviewItems.findMany({
      where: and(
        eq(reviewItems.tenantId, DEMO_TENANT_ID),
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

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantTenants, assistantRuns, reviewItems } from '@/db/schema/app'
import { eq, and, gte, count, inArray } from 'drizzle-orm'
import { AssistantStatus, ReviewStatus } from '@/types'
import type { DashboardMetrics } from '@/types'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const linkedIds = db
    .select({ assistantId: assistantTenants.assistantId })
    .from(assistantTenants)
    .where(eq(assistantTenants.tenantId, tenantId))

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [runsToday, allAssistants, activeAssistants, openReviews] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(assistantRuns)
          .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
          .innerJoin(assistantTenants, and(
            eq(assistantTenants.assistantId, assistants.id),
            eq(assistantTenants.tenantId, tenantId),
          ))
          .where(gte(assistantRuns.createdAt, today)),
        db
          .select({ count: count() })
          .from(assistants)
          .where(inArray(assistants.id, linkedIds)),
        db
          .select({ count: count() })
          .from(assistants)
          .where(
            and(
              inArray(assistants.id, linkedIds),
              eq(assistants.status, AssistantStatus.ACTIVE)
            )
          ),
        db
          .select({ count: count() })
          .from(reviewItems)
          .where(
            and(
              eq(reviewItems.tenantId, tenantId),
              eq(reviewItems.status, ReviewStatus.OPEN)
            )
          ),
      ])

    const tasksToday = runsToday[0]?.count ?? 0
    const total = allAssistants[0]?.count ?? 0
    const active = activeAssistants[0]?.count ?? 0
    const open = openReviews[0]?.count ?? 0

    const metrics: DashboardMetrics = {
      tasksToday: Number(tasksToday),
      timeSavedMinutes: Number(tasksToday) * 3,
      activeAssistants: Number(active),
      totalAssistants: Number(total),
      openReviewItems: Number(open),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[metrics]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
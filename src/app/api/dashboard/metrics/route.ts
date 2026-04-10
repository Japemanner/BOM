import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantRuns, reviewItems } from '@/db/schema'
import { eq, and, gte, count } from 'drizzle-orm'
import { AssistantStatus, ReviewStatus } from '@/types'
import type { DashboardMetrics } from '@/types'

// Demo tenant ID — vervang door sessie-lookup zodra auth compleet is
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [runsToday, allAssistants, activeAssistants, openReviews] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(assistantRuns)
          .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
          .where(
            and(
              eq(assistants.tenantId, DEMO_TENANT_ID),
              gte(assistantRuns.createdAt, today)
            )
          ),
        db
          .select({ count: count() })
          .from(assistants)
          .where(eq(assistants.tenantId, DEMO_TENANT_ID)),
        db
          .select({ count: count() })
          .from(assistants)
          .where(
            and(
              eq(assistants.tenantId, DEMO_TENANT_ID),
              eq(assistants.status, AssistantStatus.ACTIVE)
            )
          ),
        db
          .select({ count: count() })
          .from(reviewItems)
          .where(
            and(
              eq(reviewItems.tenantId, DEMO_TENANT_ID),
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

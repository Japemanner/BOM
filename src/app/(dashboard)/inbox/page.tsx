import { redirect } from 'next/navigation'
import { db } from '@/db'
import { reviewItems as reviewItemsTable, assistants } from '@/db/schema/app'
import { eq, desc } from 'drizzle-orm'
import { getSessionOutcome } from '@/lib/session'
import { ReviewStatus, ReviewPriority } from '@/types'
import { InboxClient } from '@/components/inbox/inbox-client'

interface ReviewItemRow {
  id: string
  title: string
  description: string
  priority: ReviewPriority
  status: ReviewStatus
  createdAt: Date
  assistantId: string | null
  assistantName: string | null
  resolvedAt: Date | null
  resolvedBy: string | null
}

export default async function InboxPage() {
  const result = await getSessionOutcome()

  if (!result.ok) {
    if (result.reason === 'not_authenticated') redirect('/login')
    // Bij no_tenant of db_error: toon pagina zonder data (client toont lege staat)
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-slate-900">Review-inbox</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Openstaande review-items</p>
        <div className="text-center text-slate-400 py-12 text-sm">
          Controleer je tenant-instellingen.
        </div>
      </div>
    )
  }

  const tenantId = result.tenantId

  const rows = await db
    .select({
      id: reviewItemsTable.id,
      title: reviewItemsTable.title,
      description: reviewItemsTable.description,
      priority: reviewItemsTable.priority,
      status: reviewItemsTable.status,
      createdAt: reviewItemsTable.createdAt,
      assistantId: assistants.id,
      assistantName: assistants.name,
      resolvedAt: reviewItemsTable.resolvedAt,
      resolvedBy: reviewItemsTable.resolvedBy,
    })
    .from(reviewItemsTable)
    .leftJoin(assistants, eq(reviewItemsTable.assistantId, assistants.id))
    .where(eq(reviewItemsTable.tenantId, tenantId))
    .orderBy(desc(reviewItemsTable.createdAt))
    .limit(200)

  const items: ReviewItemRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority as ReviewPriority,
    status: r.status as ReviewStatus,
    createdAt: r.createdAt,
    assistantId: r.assistantId ?? null,
    assistantName: r.assistantName ?? null,
    resolvedAt: r.resolvedAt,
    resolvedBy: r.resolvedBy,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <h1 className="text-xl font-semibold text-slate-900 flex-shrink-0">Review-inbox</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6 flex-shrink-0">
        {items.filter((i) => i.status === 'open').length} open — {items.length} totaal
      </p>
      <InboxClient items={items} />
    </div>
  )
}

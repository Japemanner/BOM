import { redirect, notFound } from 'next/navigation'
import { db } from '@/db'
import { reviewItems as reviewItemsTable, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { getSessionOutcome } from '@/lib/session'
import { ReviewStatus } from '@/types'
import { ReviewDetail } from '@/components/inbox/review-detail'

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const result = await getSessionOutcome()

  if (!result.ok) {
    if (result.reason === 'not_authenticated') redirect('/login')
    // Geen tenant of DB error: stuur terug naar inbox
    redirect('/inbox')
  }

  const { id } = await params

  const [row] = await db
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
      metadata: reviewItemsTable.metadata,
    })
    .from(reviewItemsTable)
    .leftJoin(assistants, eq(reviewItemsTable.assistantId, assistants.id))
    .where(eq(reviewItemsTable.id, id))
    .limit(1)

  if (!row || row.id !== id) {
    // Tenant-isolatie: item bestaat niet of hoort niet bij deze tenant
    notFound()
  }

  const item = {
    ...row,
    priority: row.priority as 'low' | 'medium' | 'high' | 'critical',
    status: row.status as ReviewStatus,
    createdAt: row.createdAt,
    assistantId: row.assistantId ?? null,
    assistantName: row.assistantName ?? null,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
  }

  return <ReviewDetail item={item} />
}

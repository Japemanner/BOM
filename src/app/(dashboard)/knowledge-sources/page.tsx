import { redirect } from 'next/navigation'
import { KnowledgeSourcesView } from '@/components/knowledge/knowledge-sources-view'
import { getSessionOutcome } from '@/lib/session'
import { db } from '@/db'
import { knowledgeSources } from '@/db/schema/app'
import { eq, desc } from 'drizzle-orm'
import type { KnowledgeSource } from '@/types'

async function getKnowledgeSources(tenantId: string): Promise<KnowledgeSource[]> {
  const rows = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.tenantId, tenantId))
    .orderBy(desc(knowledgeSources.createdAt))

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    status: r.status as KnowledgeSource['status'],
    documentCount: r.documentCount,
    config: r.config as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export default async function KnowledgeSourcesPage() {
  const result = await getSessionOutcome()

  if (!result.ok) {
    if (result.reason === 'not_authenticated') redirect('/login')
    return <KnowledgeSourcesView sources={[]} />
  }

  const sources = await getKnowledgeSources(result.tenantId)

  return <KnowledgeSourcesView sources={sources} />
}

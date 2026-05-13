import { redirect } from 'next/navigation'
import { AssistantDashboard } from '@/components/dashboard/assistant-dashboard'
import type { MetricsData } from '@/components/dashboard/metrics-strip'
import type { AssistantStatus } from '@/types'
import { getSessionOutcome } from '@/lib/session'
import { db } from '@/db'
import { assistants, assistantTenants, assistantRuns, reviewItems, assistantKnowledgeSources, knowledgeSources } from '@/db/schema/app'
import { eq, and, gte, count, inArray, sql } from 'drizzle-orm'

interface AssistantRow {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
  canUploadFiles: boolean
  knowledgeSources: { id: string; name: string }[]
}

function linkedIds(tenantId: string) {
  return db
    .select({ assistantId: assistantTenants.assistantId })
    .from(assistantTenants)
    .where(eq(assistantTenants.tenantId, tenantId))
}

async function ensureMigration0011() {
  try {
    const check = await db.execute(sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'assistant_tenants')`);
    const exists = check.rows[0].exists;
    if (exists) return;

    await db.execute(sql`CREATE TABLE app.assistant_tenants (assistant_id uuid NOT NULL, tenant_id uuid NOT NULL, created_at timestamp DEFAULT now() NOT NULL, CONSTRAINT assistant_tenants_pk PRIMARY KEY (assistant_id, tenant_id))`);
    await db.execute(sql`INSERT INTO app.assistant_tenants (assistant_id, tenant_id, created_at) SELECT id, tenant_id, created_at FROM app.assistants WHERE tenant_id IS NOT NULL`);
    await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_assistant_id_fk FOREIGN KEY (assistant_id) REFERENCES app.assistants(id) ON DELETE CASCADE`);
    await db.execute(sql`ALTER TABLE app.assistant_tenants ADD CONSTRAINT assistant_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE CASCADE`);
    await db.execute(sql`ALTER TABLE app.assistants DROP CONSTRAINT IF EXISTS assistants_tenant_id_tenants_id_fk`);
    await db.execute(sql`ALTER TABLE app.assistants DROP COLUMN IF EXISTS tenant_id`);
  } catch {
    // stil falen als al bestaat of DB niet bereikbaar
  }
}

async function getMetrics(tenantId: string): Promise<MetricsData> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tenantIds = linkedIds(tenantId)

  const [[totalRows], [activeRows], [runsRes], [reviewRes]] = await Promise.all([
    db
      .select({ count: count() })
      .from(assistants)
      .where(inArray(assistants.id, tenantIds)),
    db
      .select({ count: count() })
      .from(assistants)
      .where(and(inArray(assistants.id, tenantIds), eq(assistants.status, 'active' as const))),
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
      .from(reviewItems)
      .where(and(eq(reviewItems.tenantId, tenantId), eq(reviewItems.status, 'open' as const))),
  ])

  const totalCount = Number(totalRows?.count ?? 0)
  const activeCount = Number(activeRows?.count ?? 0)
  const runsToday = Number(runsRes?.count ?? 0)
  const openReviewCount = Number(reviewRes?.count ?? 0)

  return {
    savedMinutes: runsToday * 3,
    activeCount,
    totalCount,
    runsToday,
    openReviewCount,
  }
}

async function getAssistants(tenantId: string): Promise<AssistantRow[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tenantIds = linkedIds(tenantId)

  const rows = await db
    .select()
    .from(assistants)
    .where(inArray(assistants.id, tenantIds))
    .orderBy(assistants.createdAt)

  const runCounts = await db
    .select({
      assistantId: assistantRuns.assistantId,
      count: count(),
    })
    .from(assistantRuns)
    .where(gte(assistantRuns.createdAt, today))
    .groupBy(assistantRuns.assistantId)

  const countMap = new Map(runCounts.map((r) => [r.assistantId, Number(r.count)]))

  const ksRows = await db
    .select({
      assistantId: assistantKnowledgeSources.assistantId,
      knowledgeSourceId: knowledgeSources.id,
      knowledgeSourceName: knowledgeSources.name,
    })
    .from(assistantKnowledgeSources)
    .innerJoin(knowledgeSources, eq(assistantKnowledgeSources.knowledgeSourceId, knowledgeSources.id))
    .where(eq(knowledgeSources.tenantId, tenantId))

  const ksMap = new Map<string, { id: string; name: string }[]>()
  for (const row of ksRows) {
    if (!ksMap.has(row.assistantId)) ksMap.set(row.assistantId, [])
    ksMap.get(row.assistantId)!.push({ id: row.knowledgeSourceId, name: row.knowledgeSourceName })
  }

  return rows.map((a) => {
    const config = (a.config ?? {}) as Record<string, unknown>
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type,
      status: a.status as AssistantStatus,
      runsToday: countMap.get(a.id) ?? 0,
      lastError: a.status === 'error' ? 'Verbindingsfout' : undefined,
      canUploadFiles: config.canUploadFiles === true,
      knowledgeSources: ksMap.get(a.id) ?? [],
    }
  })
}

export default async function DashboardPage() {
  await ensureMigration0011();

  const result = await getSessionOutcome()

  if (!result.ok) {
    if (result.reason === 'not_authenticated') redirect('/login')
    return <AssistantDashboard metrics={{
      savedMinutes: 0, activeCount: 0, totalCount: 0, runsToday: 0, openReviewCount: 0,
    }} assistants={[]} />
  }

  const [metrics, assistants] = await Promise.all([
    getMetrics(result.tenantId),
    getAssistants(result.tenantId),
  ])

  return <AssistantDashboard metrics={metrics} assistants={assistants} />
}
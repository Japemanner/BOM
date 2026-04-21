import { redirect } from 'next/navigation'
import { AssistantDashboard } from '@/components/dashboard/assistant-dashboard'
import type { MetricsData } from '@/components/dashboard/metrics-strip'
import type { AssistantStatus } from '@/types'
import { getSessionOutcome } from '@/lib/session'

interface AssistantRow {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
}

async function getMetrics(_tenantId: string): Promise<MetricsData> {
  return {
    savedMinutes: 0,
    activeCount: 0,
    totalCount: 0,
    runsToday: 0,
    openReviewCount: 0,
  }
}

async function getAssistants(_tenantId: string): Promise<AssistantRow[]> {
  return []
}

export default async function DashboardPage() {
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
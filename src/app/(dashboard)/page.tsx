import { AssistantDashboard } from '@/components/dashboard/assistant-dashboard'
import type { MetricsData } from '@/components/dashboard/metrics-strip'
import type { AssistantStatus } from '@/types'

interface AssistantRow {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
}

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

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
  const [metrics, assistants] = await Promise.all([
    getMetrics(DEMO_TENANT_ID),
    getAssistants(DEMO_TENANT_ID),
  ])

  return <AssistantDashboard metrics={metrics} assistants={assistants} />
}

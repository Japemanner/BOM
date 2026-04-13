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
    savedMinutes: 141,
    activeCount: 3,
    totalCount: 5,
    runsToday: 47,
    openReviewCount: 8,
  }
}

async function getAssistants(_tenantId: string): Promise<AssistantRow[]> {
  const assistants: AssistantRow[] = [
    { id: '1', name: 'Factuurverwerker', description: 'Verwerkt inkomende UBL-facturen automatisch', type: 'factuur', status: 'active', runsToday: 23 },
    { id: '2', name: 'E-mail classifier', description: 'Categoriseert klantvragen op onderwerp', type: 'email', status: 'active', runsToday: 18 },
    { id: '3', name: 'Exact sync', description: 'Synchroniseert boekingen met Exact Online', type: 'ubl', status: 'error', runsToday: 0, lastError: 'API token verlopen' },
    { id: '4', name: 'Rapportage bot', description: 'Genereert wekelijkse managementrapporten', type: 'rapport', status: 'active', runsToday: 6 },
    { id: '5', name: 'Contract checker', description: 'Controleert contracten op aflopende datums', type: 'contract', status: 'paused', runsToday: 0 },
  ]
  const order: Record<AssistantStatus, number> = { error: 0, active: 1, paused: 2 }
  return assistants.sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2))
}

export default async function DashboardPage() {
  const [metrics, assistants] = await Promise.all([
    getMetrics(DEMO_TENANT_ID),
    getAssistants(DEMO_TENANT_ID),
  ])

  return <AssistantDashboard metrics={metrics} assistants={assistants} />
}

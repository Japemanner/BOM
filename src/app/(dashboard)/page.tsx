'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { AssistantRow } from '@/components/dashboard/assistant-row'
import { ReviewItemCard } from '@/components/dashboard/review-item'
import {
  AssistantStatus,
  ReviewPriority,
  ReviewStatus,
  type DashboardMetrics,
} from '@/types'

interface Assistant {
  id: string
  name: string
  description: string
  status: AssistantStatus
  runsToday: number
}

interface ReviewItem {
  id: string
  title: string
  description: string
  priority: ReviewPriority
  status: ReviewStatus
}

const MOCK_METRICS: DashboardMetrics = {
  tasksToday: 47,
  timeSavedMinutes: 141,
  activeAssistants: 3,
  totalAssistants: 5,
  openReviewItems: 8,
}

const MOCK_ASSISTANTS: Assistant[] = [
  {
    id: '1',
    name: 'Factuurverwerker',
    description: 'Verwerkt inkomende UBL-facturen',
    status: AssistantStatus.ACTIVE,
    runsToday: 23,
  },
  {
    id: '2',
    name: 'E-mail classifier',
    description: 'Categoriseert klantvragen',
    status: AssistantStatus.ACTIVE,
    runsToday: 18,
  },
  {
    id: '3',
    name: 'Exact sync',
    description: 'Synchroniseert boekingen met Exact',
    status: AssistantStatus.PAUSED,
    runsToday: 6,
  },
  {
    id: '4',
    name: 'Rapportage bot',
    description: 'Genereert weekrapporten',
    status: AssistantStatus.ACTIVE,
    runsToday: 0,
  },
  {
    id: '5',
    name: 'Data validator',
    description: 'Controleert datakwaliteit',
    status: AssistantStatus.ERROR,
    runsToday: 0,
  },
]

const MOCK_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: 'r1',
    title: 'Factuur #2024-891 — afwijkend bedrag',
    description: 'Ontvangen bedrag €1.240 vs verwacht €1.200',
    priority: ReviewPriority.HIGH,
    status: ReviewStatus.OPEN,
  },
  {
    id: 'r2',
    title: 'Dubbele boeking gedetecteerd',
    description: 'Transactie TXN-4421 lijkt al verwerkt',
    priority: ReviewPriority.CRITICAL,
    status: ReviewStatus.OPEN,
  },
  {
    id: 'r3',
    title: 'Nieuwe leverancier — handmatig goedkeuren',
    description: 'Acme BV staat nog niet in Exact',
    priority: ReviewPriority.MEDIUM,
    status: ReviewStatus.OPEN,
  },
  {
    id: 'r4',
    title: 'Classificatie onzeker: algemene vraag',
    description: 'Confidence score 52% — beoordeel handmatig',
    priority: ReviewPriority.LOW,
    status: ReviewStatus.OPEN,
  },
  {
    id: 'r5',
    title: 'BTW-code niet herkend',
    description: 'Code "G3" onbekend in belastingmapping',
    priority: ReviewPriority.HIGH,
    status: ReviewStatus.OPEN,
  },
]

export default function DashboardPage() {
  const queryClient = useQueryClient()

  const { data: metrics, isLoading: metricsLoading } =
    useQuery<DashboardMetrics>({
      queryKey: ['dashboard', 'metrics'],
      queryFn: async () => {
        const res = await fetch('/api/dashboard/metrics')
        if (!res.ok) return MOCK_METRICS
        return res.json() as Promise<DashboardMetrics>
      },
      refetchInterval: 1000 * 30,
      placeholderData: MOCK_METRICS,
    })

  const { data: assistants = MOCK_ASSISTANTS } = useQuery<Assistant[]>({
    queryKey: ['assistants'],
    queryFn: async () => {
      const res = await fetch('/api/assistants')
      if (!res.ok) return MOCK_ASSISTANTS
      return res.json() as Promise<Assistant[]>
    },
    placeholderData: MOCK_ASSISTANTS,
  })

  const { data: reviewItems = MOCK_REVIEW_ITEMS } = useQuery<ReviewItem[]>({
    queryKey: ['review', 'open'],
    queryFn: async () => {
      const res = await fetch('/api/review')
      if (!res.ok) return MOCK_REVIEW_ITEMS
      return res.json() as Promise<ReviewItem[]>
    },
    placeholderData: MOCK_REVIEW_ITEMS,
  })

  const toggleAssistant = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: AssistantStatus
    }) => {
      const res = await fetch(`/api/assistants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Toggle mislukt')
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assistants'] })
    },
  })

  const resolveReview = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: ReviewStatus
    }) => {
      const res = await fetch(`/api/review/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Actie mislukt')
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] })
    },
  })

  const displayedMetrics = metrics ?? MOCK_METRICS
  const topReviewItems = reviewItems.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overzicht van vandaag</p>
      </div>

      {/* Metric cards */}
      <MetricsGrid metrics={displayedMetrics} isLoading={metricsLoading} />

      {/* Assistenten + Review kolommen */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Assistenten lijst */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Assistenten
            </h2>
            <a
              href="/assistants"
              className="text-xs text-blue-500 hover:underline"
            >
              Alle bekijken →
            </a>
          </div>
          <div className="space-y-2">
            {assistants.map((assistant) => (
              <AssistantRow
                key={assistant.id}
                {...assistant}
                onToggle={async (id, status) => {
                  await toggleAssistant.mutateAsync({ id, status })
                }}
              />
            ))}
          </div>
        </div>

        {/* Review-inbox paneel */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Review-inbox
            </h2>
            {reviewItems.length > 0 && (
              <span className="text-xs text-slate-500">
                {reviewItems.length} open
              </span>
            )}
          </div>
          <div className="space-y-2">
            {topReviewItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-500">Geen open items</p>
              </div>
            ) : (
              topReviewItems.map((item) => (
                <ReviewItemCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  priority={item.priority}
                  onAction={async (id, status) => {
                    await resolveReview.mutateAsync({ id, status })
                  }}
                />
              ))
            )}
          </div>
          {reviewItems.length > 5 && (
            <a
              href="/inbox"
              className="block text-center text-xs text-blue-500 hover:underline mt-2"
            >
              +{reviewItems.length - 5} meer in inbox →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

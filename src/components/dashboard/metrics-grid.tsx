import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, Bot, AlertTriangle } from 'lucide-react'
import type { DashboardMetrics } from '@/types'

interface MetricsGridProps {
  metrics: DashboardMetrics
  isLoading?: boolean
}

interface MetricCard {
  title: string
  value: string
  description: string
  icon: React.ElementType
  iconColor: string
}

function buildCards(metrics: DashboardMetrics): MetricCard[] {
  return [
    {
      title: 'Taken vandaag',
      value: metrics.tasksToday.toString(),
      description: 'Verwerkt door assistenten',
      icon: CheckCircle2,
      iconColor: 'text-green-500',
    },
    {
      title: 'Tijd bespaard',
      value: `${metrics.timeSavedMinutes} min`,
      description: 'Geschatte tijdsbesparing vandaag',
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Actieve assistenten',
      value: `${metrics.activeAssistants}/${metrics.totalAssistants}`,
      description: 'Momenteel actief',
      icon: Bot,
      iconColor: 'text-blue-600',
    },
    {
      title: 'Open review-items',
      value: metrics.openReviewItems.toString(),
      description: 'Wachten op beoordeling',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
  ]
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-3 w-36 bg-slate-100 rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  const cards = buildCards(metrics)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

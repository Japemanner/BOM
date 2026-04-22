'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Check,
  X,
  ExternalLink,
  Filter,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Circle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewPriority, ReviewStatus } from '@/types'

interface InboxItem {
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

interface InboxClientProps {
  items: InboxItem[]
}

const priorityConfig: Record<
  ReviewPriority,
  { label: string; icon: React.ElementType; className: string }
> = {
  [ReviewPriority.CRITICAL]: {
    label: 'Kritiek',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  [ReviewPriority.HIGH]: {
    label: 'Hoog',
    icon: ArrowUpCircle,
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  [ReviewPriority.MEDIUM]: {
    label: 'Midden',
    icon: Circle,
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [ReviewPriority.LOW]: {
    label: 'Laag',
    icon: ArrowDownCircle,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

const statusConfig: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  [ReviewStatus.OPEN]: {
    label: 'Open',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  [ReviewStatus.APPROVED]: {
    label: 'Goedgekeurd',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  [ReviewStatus.REJECTED]: {
    label: 'Afgewezen',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  [ReviewStatus.IGNORED]: {
    label: 'Genegeerd',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  },
}

type FilterStatus = 'all' | ReviewStatus

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

export function InboxClient({ items }: InboxClientProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterPriority, setFilterPriority] = useState<ReviewPriority | 'all'>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let out = [...items]
    if (filterStatus !== 'all') {
      out = out.filter((i) => i.status === filterStatus)
    }
    if (filterPriority !== 'all') {
      out = out.filter((i) => i.priority === filterPriority)
    }
    return out
  }, [items, filterStatus, filterPriority])

  const handleAction = useCallback(
    async (id: string, status: ReviewStatus) => {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/review/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Onbekende fout' }))
          console.error('[review action]', data.error ?? res.status)
          return
        }
        // Hard refresh om lijst opnieuw te laden vanuit server
        window.location.reload()
      } catch (err) {
        console.error('[review action]', err)
      } finally {
        setLoadingId(null)
      }
    },
    []
  )

  const counts = useMemo(() => {
    const status = {
      open: items.filter((i) => i.status === 'open').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
      ignored: items.filter((i) => i.status === 'ignored').length,
    }
    const priority = {
      critical: items.filter((i) => i.priority === 'critical').length,
      high: items.filter((i) => i.priority === 'high').length,
      medium: items.filter((i) => i.priority === 'medium').length,
      low: items.filter((i) => i.priority === 'low').length,
    }
    return { status, priority }
  }, [items])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <circle className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Geen review-items gevonden.</p>
      </div>
    )
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Status:</span>
          {([
            ['all', `Alle (${items.length})`],
            ['open', `Open (${counts.status.open})`],
            ['approved', `Goedgekeurd (${counts.status.approved})`],
            ['rejected', `Afgewezen (${counts.status.rejected})`],
            ['ignored', `Genegeerd (${counts.status.ignored})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                filterStatus === key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Prioriteit:</span>
          {([
            ['all', `Alle`],
            ['critical', `Kritiek (${counts.priority.critical})`],
            ['high', `Hoog (${counts.priority.high})`],
            ['medium', `Midden (${counts.priority.medium})`],
            ['low', `Laag (${counts.priority.low})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterPriority(key as ReviewPriority | 'all')}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                filterPriority === key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filtered.map((item) => {
          const pri = priorityConfig[item.priority]
          const st = statusConfig[item.status]
          const isOpen = item.status === 'open'
          const isLoading = loadingId === item.id
          const PriIcon = pri.icon

          return (
            <div
              key={item.id}
              data-testid={`review-item-${item.id}`}
              className="rounded-lg border border-slate-100 bg-white p-4 space-y-2 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium text-slate-900 truncate">{item.title}</h3>
                    <Badge variant="outline" className={`text-xs shrink-0 ${pri.className}`}>
                      <PriIcon className="h-3 w-3 mr-1 inline" />
                      {pri.label}
                    </Badge>
                    <Badge variant="outline" className={`text-xs shrink-0 ${st.className}`}>
                      {st.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {item.assistantName ? (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-500">Assistent:</span> {item.assistantName}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic">Geen assistent</span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span>{formatDate(item.createdAt)}</span>
                    {item.resolvedAt && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400">
                          Afgerond {formatDate(item.resolvedAt)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-1 border-green-200 text-green-700 hover:bg-green-50"
                    disabled={isLoading}
                    onClick={() => void handleAction(item.id, ReviewStatus.APPROVED)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {isLoading ? 'Bezig...' : 'Goedkeuren'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={isLoading}
                    onClick={() => void handleAction(item.id, ReviewStatus.REJECTED)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    {isLoading ? 'Bezig...' : 'Afwijzen'}
                  </Button>
                  <a
                    href={`/inbox/${item.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                    aria-label="Details"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

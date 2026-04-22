'use client'

import { useState, useCallback } from 'react'
import { Check, X, ArrowLeft, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewPriority, ReviewStatus } from '@/types'

interface ReviewDetailItem {
  id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: ReviewStatus
  createdAt: Date
  assistantId: string | null
  assistantName: string | null
  resolvedAt: Date | null
  resolvedBy: string | null
}

interface ReviewDetailProps {
  item: ReviewDetailItem
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

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

export function ReviewDetail({ item }: ReviewDetailProps) {
  const [loading, setLoading] = useState<ReviewStatus | null>(null)

  const handleAction = useCallback(async (status: ReviewStatus) => {
    setLoading(status)
    try {
      const res = await fetch(`/api/review/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Onbekende fout' }))
        console.error('[review action]', data.error ?? res.status)
        return
      }
      // Terug naar inbox na succes
      window.location.href = '/inbox'
    } catch (err) {
      console.error('[review action]', err)
    } finally {
      setLoading(null)
    }
  }, [item.id])

  const pri = priorityConfig[item.priority as ReviewPriority] ?? priorityConfig.medium
  const PriIcon = pri.icon
  const isOpen = item.status === 'open'

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <a
          href="/inbox"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar inbox
        </a>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900">{item.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${pri.className}`}>
                <PriIcon className="h-3 w-3 mr-1 inline" />
                {pri.label}
              </Badge>
              {item.status !== 'open' && (
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                  {item.status === 'approved' ? 'Goedgekeurd' : item.status === 'rejected' ? 'Afgewezen' : 'Genegeerd'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {item.description}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500">
          <div>
            <span className="text-slate-400">Assistent:</span>{' '}
            {item.assistantName ?? <span className="text-slate-300 italic">Geen</span>}
          </div>
          <div>
            <span className="text-slate-400">Aangemaakt:</span> {formatDate(item.createdAt)}
          </div>
          {item.resolvedAt && (
            <div>
              <span className="text-slate-400">Afgerond:</span> {formatDate(item.resolvedAt)}
            </div>
          )}
          {item.resolvedBy && (
            <div>
              <span className="text-slate-400">Afgehandeld door:</span> {item.resolvedBy}
            </div>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm flex-1 border-green-200 text-green-700 hover:bg-green-50"
              disabled={loading !== null}
              onClick={() => void handleAction(ReviewStatus.APPROVED)}
            >
              <Check className="h-4 w-4 mr-1.5" />
              {loading === ReviewStatus.APPROVED ? 'Bezig...' : 'Goedkeuren'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm flex-1 border-red-200 text-red-700 hover:bg-red-50"
              disabled={loading !== null}
              onClick={() => void handleAction(ReviewStatus.REJECTED)}
            >
              <X className="h-4 w-4 mr-1.5" />
              {loading === ReviewStatus.REJECTED ? 'Bezig...' : 'Afwijzen'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-sm flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
              disabled={loading !== null}
              onClick={() => void handleAction(ReviewStatus.IGNORED)}
            >
              Negeer
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

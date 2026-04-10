'use client'

import { useState } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { ReviewPriority, ReviewStatus } from '@/types'

interface ReviewItemCardProps {
  id: string
  title: string
  description: string
  priority: ReviewPriority
  onAction: (id: string, status: ReviewStatus) => Promise<void>
}

const priorityConfig: Record<
  ReviewPriority,
  { label: string; className: string }
> = {
  [ReviewPriority.CRITICAL]: {
    label: 'Kritiek',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  [ReviewPriority.HIGH]: {
    label: 'Hoog',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  [ReviewPriority.MEDIUM]: {
    label: 'Midden',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  [ReviewPriority.LOW]: {
    label: 'Laag',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

export function ReviewItemCard({
  id,
  title,
  description,
  priority,
  onAction,
}: ReviewItemCardProps) {
  const [loading, setLoading] = useState<ReviewStatus | null>(null)
  const config = priorityConfig[priority]

  const handleAction = async (status: ReviewStatus) => {
    setLoading(status)
    await onAction(id, status)
    setLoading(null)
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {description}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${config.className}`}
        >
          {config.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1 border-green-200 text-green-700 hover:bg-green-50"
          disabled={loading !== null}
          onClick={() => void handleAction(ReviewStatus.APPROVED)}
        >
          <Check className="h-3 w-3 mr-1" />
          {loading === ReviewStatus.APPROVED ? '...' : 'Goedkeuren'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-1 border-red-200 text-red-700 hover:bg-red-50"
          disabled={loading !== null}
          onClick={() => void handleAction(ReviewStatus.REJECTED)}
        >
          <X className="h-3 w-3 mr-1" />
          {loading === ReviewStatus.REJECTED ? '...' : 'Afwijzen'}
        </Button>
        <a
          href={`/inbox/${id}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
          aria-label="Bekijk item"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

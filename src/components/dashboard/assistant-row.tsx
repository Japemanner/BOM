'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AssistantStatus } from '@/types'

interface AssistantRowProps {
  id: string
  name: string
  description: string
  status: AssistantStatus
  runsToday: number
  onToggle: (id: string, newStatus: AssistantStatus) => Promise<void>
}

const statusConfig: Record<AssistantStatus, { label: string; dot: string }> = {
  [AssistantStatus.ACTIVE]: { label: 'Actief', dot: 'bg-green-500' },
  [AssistantStatus.PAUSED]: { label: 'Gepauzeerd', dot: 'bg-amber-500' },
  [AssistantStatus.ERROR]: { label: 'Fout', dot: 'bg-red-500' },
}

export function AssistantRow({
  id,
  name,
  description,
  status,
  runsToday,
  onToggle,
}: AssistantRowProps) {
  const [loading, setLoading] = useState(false)
  const config = statusConfig[status]

  const handleToggle = async () => {
    setLoading(true)
    const newStatus =
      status === AssistantStatus.ACTIVE
        ? AssistantStatus.PAUSED
        : AssistantStatus.ACTIVE
    await onToggle(id, newStatus)
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-white border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <Bot className="h-8 w-8 text-slate-300" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${config.dot}`}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
          <p className="text-xs text-slate-500 truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 ml-4">
        <span className="text-xs text-slate-500 hidden sm:block">
          {runsToday} vandaag
        </span>
        <Badge variant="outline" className="text-xs hidden sm:flex">
          {config.label}
        </Badge>
        <button
          onClick={() => void handleToggle()}
          disabled={loading}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            status === AssistantStatus.ACTIVE ? 'bg-blue-500' : 'bg-slate-200'
          }`}
          aria-label={`Toggle ${name}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              status === AssistantStatus.ACTIVE
                ? 'translate-x-4'
                : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

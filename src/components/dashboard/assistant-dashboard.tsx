'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Users, Star, ChevronRight, AlertCircle } from 'lucide-react'
import { AssistantCard } from './assistant-card'
import { MetricsStrip, type MetricsData } from './metrics-strip'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import type { AssistantStatus } from '@/types'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
}

interface Template {
  id: string
  naam: string
  sub: string
  icon: React.ElementType
  bg: string
  color: string
}

const TEMPLATES: Template[] = [
  {
    id: 'btw',
    naam: 'BTW-aangifte voorbereiding',
    sub: 'Automatisch kwartaaloverzicht vanuit boekhouding',
    icon: FileText,
    bg: '#EFF6FF',
    color: '#3B82F6',
  },
  {
    id: 'hr-verlof',
    naam: 'HR verlofverwerking',
    sub: 'Verlofaanvragen beoordelen en registreren',
    icon: Users,
    bg: '#F0FDF4',
    color: '#22C55E',
  },
  {
    id: 'nps',
    naam: 'NPS-opvolging',
    sub: 'Klanttevredenheid meten en automatisch opvolgen',
    icon: Star,
    bg: '#FDF4FF',
    color: '#A855F7',
  },
]

interface AssistantDashboardProps {
  metrics: MetricsData
  assistants: Assistant[]
}

async function patchAssistantStatus(id: string, status: 'active' | 'paused') {
  const res = await fetch(`/api/assistants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('PATCH mislukt')
}

export function AssistantDashboard({ metrics, assistants }: AssistantDashboardProps) {
  const router = useRouter()

  const { states, toggle, errorMessage, clearError } = useOptimisticToggle(
    assistants.map((a) => ({ id: a.id, status: a.status })),
    patchAssistantStatus
  )

  const patchFn = useCallback(
    async (id: string, newStatus: 'active' | 'paused') => {
      await toggle(id, newStatus)
    },
    [toggle]
  )

  // Sorteer: error eerst, dan active, dan paused
  const sorted = [...assistants].sort((a, b) => {
    const order: Record<AssistantStatus, number> = { error: 0, active: 1, paused: 2 }
    return (order[states.get(a.id) ?? a.status] ?? 2) - (order[states.get(b.id) ?? b.status] ?? 2)
  })

  const errorAssistants = assistants.filter((a) => (states.get(a.id) ?? a.status) === 'error')
  const activeCount = [...states.values()].filter((s) => s === 'active').length
  const showTemplates = assistants.length < 12

  // Dynamische metrics met optimistic active count
  const liveMetrics: MetricsData = {
    ...metrics,
    activeCount,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast foutmelding */}
      {errorMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#0F172A',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {errorMessage}
          <button
            onClick={clearError}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Metrics strip */}
      <MetricsStrip metrics={liveMetrics} />

      {/* Alert bar — alleen bij error */}
      {errorAssistants.map((a) => (
        <div
          key={a.id}
          onClick={() => router.push(`/assistants/${a.id}?tab=connection`)}
          style={{
            background: '#FEF2F2',
            border: '0.5px solid #FECACA',
            borderRadius: 8,
            padding: '9px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#B91C1C', flex: 1 }}>
            <strong>{a.name}</strong> staat uit — {a.lastError ?? 'verbindingsfout'}. Klik om te herstellen.
          </span>
          <ChevronRight size={14} color="#B91C1C" />
        </div>
      ))}

      {/* Sectieheader */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Jouw assistenten
        </span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>
          {activeCount} actief
        </span>
      </div>

      {/* Assistent cards grid */}
      <div
        style={{ display: 'grid', gap: 10 }}
        className="assistant-grid"
      >
        {sorted.map((assistant) => {
          const currentStatus = states.get(assistant.id) ?? assistant.status
          return (
            <AssistantCard
              key={assistant.id}
              {...assistant}
              status={currentStatus}
              onToggle={patchFn}
            />
          )
        })}
      </div>

      {/* Snel toevoegen */}
      {showTemplates && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Snel toevoegen
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10 }} className="template-grid">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon
              return (
                <div
                  key={tpl.id}
                  className="template-card"
                  style={{
                    border: '0.5px dashed #CBD5E1',
                    borderRadius: 12,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = '#3B82F6'
                    el.style.background = '#F8FBFF'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = '#CBD5E1'
                    el.style.background = 'transparent'
                  }}
                  onClick={() => router.push(`/assistants/new?template=${tpl.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: tpl.bg, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} color={tpl.color} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0F172A' }}>{tpl.naam}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 8px' }}>{tpl.sub}</p>
                  <span style={{ fontSize: 11, color: '#3B82F6' }}>+ Toevoegen</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`
        .assistant-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .template-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 1023px) {
          .assistant-grid, .template-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 639px) {
          .assistant-grid, .template-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

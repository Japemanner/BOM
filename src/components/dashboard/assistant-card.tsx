'use client'

import {
  FileText,
  Mail,
  FileCheck,
  UserCheck,
  AlignLeft,
  Send,
  Bot,
  Settings,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AssistantStatus } from '@/types'

interface AssistantCardProps {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
  onToggle: (id: string, newStatus: 'active' | 'paused') => void
}

const typeConfig: Record<
  string,
  { icon: React.ElementType; bg: string; color: string }
> = {
  factuur:    { icon: FileText,   bg: '#EFF6FF', color: '#3B82F6' },
  email:      { icon: Mail,       bg: '#F0FDF4', color: '#22C55E' },
  contract:   { icon: FileCheck,  bg: '#FDF4FF', color: '#A855F7' },
  onboarding: { icon: UserCheck,  bg: '#FFFBEB', color: '#F59E0B' },
  rapport:    { icon: AlignLeft,  bg: '#F0FDFA', color: '#14B8A6' },
  ubl:        { icon: Send,       bg: '#F8FAFC', color: '#94A3B8' },
  export:     { icon: Send,       bg: '#F8FAFC', color: '#94A3B8' },
  custom:     { icon: Bot,        bg: '#F8FAFC', color: '#94A3B8' },
}

function getTypeConfig(type: string) {
  return typeConfig[type] ?? typeConfig['custom']!
}

function getBorderColor(status: AssistantStatus): string {
  if (status === 'active') return '#BFDBFE'
  if (status === 'error') return '#FECACA'
  return '#E2E8F0'
}

export function AssistantCard({
  id,
  name,
  description,
  type,
  status,
  runsToday,
  lastError,
  onToggle,
}: AssistantCardProps) {
  const router = useRouter()
  const cfg = getTypeConfig(type)
  const Icon = cfg.icon

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: `0.5px solid ${getBorderColor(status)}`,
    borderRadius: 12,
    opacity: status === 'paused' ? 0.7 : 1,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <div style={cardStyle}>
      {/* Card top */}
      <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Type icon */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: cfg.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={cfg.color} />
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </p>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {description}
          </p>
        </div>

        {/* Runs today */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{
            fontSize: 15,
            fontFamily: 'monospace',
            color: status === 'active' ? '#0F172A' : '#94A3B8',
            margin: 0,
            lineHeight: 1,
          }}>
            {status === 'active' ? runsToday : '—'}
          </p>
          <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0' }}>vandaag</p>
        </div>
      </div>

      {/* Card footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: '0.5px solid #F1F5F9',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Status pip */}
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: status === 'active' ? '#22C55E' : status === 'error' ? '#EF4444' : '#CBD5E1',
            flexShrink: 0,
          }}
        />

        {/* Status text */}
        <span style={{
          fontSize: 11,
          flex: 1,
          color: status === 'active' ? '#16A34A' : status === 'error' ? '#B91C1C' : '#94A3B8',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {status === 'active' && 'Actief'}
          {status === 'paused' && 'Gepauzeerd'}
          {status === 'error' && (lastError ?? 'Verbindingsfout')}
        </span>

        {/* Activeer knop */}
        {status === 'error' ? (
          <button
            onClick={() => router.push(`/assistants/${id}?tab=connection`)}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 7,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              background: '#FEF2F2',
              color: '#B91C1C',
              fontWeight: 500,
            }}
          >
            Herstel koppeling
          </button>
        ) : status === 'active' ? (
          <button
            aria-label={`${name} pauzeren`}
            onClick={() => onToggle(id, 'paused')}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 7,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontWeight: 500,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DBEAFE' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF' }}
          >
            Actief — pauzeer
          </button>
        ) : (
          <button
            aria-label={`${name} activeren`}
            onClick={() => onToggle(id, 'active')}
            style={{
              flex: 1,
              height: 32,
              borderRadius: 7,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              background: '#F1F5F9',
              color: '#475569',
              fontWeight: 500,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.background = '#3B82F6'
              btn.style.color = '#fff'
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.background = '#F1F5F9'
              btn.style.color = '#475569'
            }}
          >
            Activeer
          </button>
        )}

        {/* Config knop */}
        <button
          aria-label={`Instellingen ${name}`}
          onClick={() => router.push(`/assistants/${id}`)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            border: '0.5px solid #E2E8F0',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Settings size={12} color="#94A3B8" />
        </button>
      </div>
    </div>
  )
}

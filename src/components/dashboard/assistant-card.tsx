'use client'

import {
  FileText,
  Mail,
  FileCheck,
  UserCheck,
  AlignLeft,
  Send,
  Bot,
} from 'lucide-react'
import type { AssistantStatus } from '@/types'

interface AssistantCardProps {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
  tags?: string[]
  isSelected?: boolean
  onClick?: (id: string) => void
}

const TEAL = '#1D9E75'

const TYPE_CONFIG: Record<string, { icon: React.ElementType }> = {
  factuur:    { icon: FileText },
  email:      { icon: Mail },
  contract:   { icon: FileCheck },
  onboarding: { icon: UserCheck },
  rapport:    { icon: AlignLeft },
  ubl:        { icon: Send },
  export:     { icon: Send },
  custom:     { icon: Bot },
}

const TYPE_TAGS: Record<string, string[]> = {
  factuur:    ['Finance', 'Extern'],
  email:      ['Support', 'Intern'],
  ubl:        ['Finance', 'Export'],
  rapport:    ['Management'],
  contract:   ['Legal', 'Extern'],
  onboarding: ['HR', 'Intern'],
  custom:     ['Overig'],
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG['custom']!
}

export function AssistantCard({
  id,
  name,
  description,
  type,
  status,
  runsToday,
  tags,
  isSelected,
  onClick,
}: AssistantCardProps) {
  const cfg = getTypeConfig(type)
  const Icon = cfg.icon
  const isActive = status === 'active'
  const isError = status === 'error'

  const resolvedTags = tags ?? TYPE_TAGS[type] ?? ['Overig']
  const iconBg = isActive ? '#ECFDF5' : '#F3F4F6'
  const iconColor = isActive ? TEAL : '#9CA3AF'
  const statusDot = isActive ? TEAL : isError ? '#EF4444' : '#D1D5DB'

  return (
    <div
      data-testid="assistant-card"
      data-card-id={id}
      onClick={() => onClick?.(id)}
      style={{
        background: '#FFFFFF',
        border: `${isSelected ? 1.5 : 0.5}px solid ${isSelected ? TEAL : '#EAECEF'}`,
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        opacity: status === 'paused' ? 0.65 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 0.15s, opacity 0.15s, background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#D1D5DB'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = '#EAECEF'
        }
      }}
    >
      {/* Header: icon left, status dot right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={14} color={iconColor} strokeWidth={1.75} />
        </div>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusDot,
            marginTop: 3,
            flexShrink: 0,
          }}
        />
      </div>

      {/* Name + description */}
      <div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#111827',
            margin: 0,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </p>
        <p
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            margin: '3px 0 0',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>
      </div>

      {/* Footer: tags + conversations */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '0.5px solid #F3F4F6',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflow: 'hidden',
            flexShrink: 1,
          }}
        >
          {resolvedTags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                color: '#6B7280',
                background: '#F3F4F6',
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          style={{
            fontSize: 10,
            color: '#9CA3AF',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {runsToday} gesprekken
        </span>
      </div>
    </div>
  )
}

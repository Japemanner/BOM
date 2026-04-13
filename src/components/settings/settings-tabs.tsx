'use client'

import { useState } from 'react'
import { AdminAssistants } from './admin-assistants'
import type { AssistantStatus } from '@/types'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  tenantId: string
  createdAt: string
  updatedAt: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
}

interface SettingsTabsProps {
  assistants: Assistant[]
  tenants: Tenant[]
}

const tabs = [
  { id: 'algemeen', label: 'Algemeen' },
  { id: 'admin',    label: 'Admin' },
]

export function SettingsTabs({ assistants, tenants }: SettingsTabsProps) {
  const [active, setActive] = useState('admin')

  return (
    <div>
      {/* Tab nav */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid #E2E8F0',
        marginBottom: 24,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              height: 38, padding: '0 18px',
              fontSize: 13, fontWeight: active === tab.id ? 600 : 400,
              color: active === tab.id ? '#1E40AF' : '#64748B',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: active === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab inhoud */}
      {active === 'algemeen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Account" description="Persoonlijke instellingen en profiel">
            <PlaceholderRow label="Naam" value="— nog niet gekoppeld aan sessie —" />
            <PlaceholderRow label="E-mail" value="— nog niet gekoppeld aan sessie —" />
          </Section>
          <Section title="Platform" description="Versie en omgevingsinformatie">
            <PlaceholderRow label="Versie" value="0.1.0-beta" />
            <PlaceholderRow label="Omgeving" value={process.env.NODE_ENV ?? 'unknown'} />
          </Section>
        </div>
      )}

      {active === 'admin' && (
        <AdminAssistants assistants={assistants} tenants={tenants} />
      )}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: '0.5px solid #E2E8F0',
      borderRadius: 12, padding: 20,
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: '0 0 2px' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px' }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function PlaceholderRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', width: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#94A3B8' }}>{value}</span>
    </div>
  )
}

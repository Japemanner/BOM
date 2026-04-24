'use client'

import { useState } from 'react'

const TEAL = '#1D9E75'

interface SettingsTabsProps {
  // Leeg — alleen nog 'Algemeen' tab
}

const TABS = [
  { id: 'algemeen', label: 'Algemeen' },
]

export function SettingsTabs() {
  const [active, setActive] = useState('algemeen')

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '0.5px solid #EAECEF', marginBottom: 24 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              height: 38,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: active === tab.id ? 500 : 400,
              color: active === tab.id ? TEAL : '#6B7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: active === tab.id ? `2px solid ${TEAL}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'algemeen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Account" description="Persoonlijke instellingen en profiel">
            <PlaceholderRow label="Naam"   value="— nog niet gekoppeld aan sessie —" />
            <PlaceholderRow label="E-mail" value="— nog niet gekoppeld aan sessie —" />
          </Section>
          <Section title="Platform" description="Versie en omgevingsinformatie">
            <PlaceholderRow label="Versie"    value="0.1.0-beta" />
            <PlaceholderRow label="Omgeving" value={process.env.NODE_ENV ?? 'unknown'} />
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #EAECEF', borderRadius: 12, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 2px' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function PlaceholderRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', width: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{value}</span>
    </div>
  )
}
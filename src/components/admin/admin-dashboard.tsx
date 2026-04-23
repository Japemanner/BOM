'use client'

import { useState } from 'react'
import { AdminAssistants } from './admin-assistants'
import type { AssistantStatus, WebhookToken } from '@/types'

const TEAL = '#1D9E75'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  tenantId: string
  createdAt: string
  updatedAt: string
  webhookUrl: string | null
  webhookTokenEncrypted?: string | null
}

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
}

interface AdminDashboardProps {
  assistants: Assistant[]
  tenants: Tenant[]
  inboundTokens: WebhookToken[]
}

const SUBTABS = [
  { id: 'assistenten', label: 'Assistenten beheer' },
  { id: 'webhooks',    label: 'Webhook tokens' },
]

export function AdminDashboard({ assistants, tenants, inboundTokens }: AdminDashboardProps) {
  const [active, setActive] = useState('assistenten')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #EAECEF', marginBottom: 24 }}>
        {SUBTABS.map((tab) => (
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

      {/* Tab content */}
      {active === 'assistenten' && (
        <AdminAssistants
          assistants={assistants}
          tenants={tenants}
          inboundTokens={inboundTokens}
        />
      )}

      {active === 'webhooks' && (
        <div className="bg-white rounded-lg border border-slate-100 p-6">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Webhook tokens</h3>
          {inboundTokens.length === 0 ? (
            <p className="text-sm text-slate-500">Geen webhook tokens gevonden.</p>
          ) : (
            <div className="space-y-2">
              {inboundTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{token.name}</p>
                    <p className="text-xs text-slate-500">{token.assistantId ? 'Gekoppeld aan assistent' : 'Algemeen'}</p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {token.lastUsedAt ? `Laatst gebruikt: ${new Date(token.lastUsedAt).toLocaleDateString('nl-NL')}` : 'Nooit gebruikt'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

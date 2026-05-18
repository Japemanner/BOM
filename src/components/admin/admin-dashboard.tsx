'use client'

import { useState } from 'react'
import { AdminAssistants } from './admin-assistants'
import { AdminUsers } from './admin-users'
import { AdminTenantKoppelingen } from './admin-tenant-koppelingen'
import { CreateTenantModal } from './admin-create-tenant'
import type { AssistantStatus, WebhookToken } from '@/types'

const TEAL = '#1D9E75'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
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

interface Link {
  assistantId: string
  tenantId: string
}

interface AdminDashboardProps {
  assistants: Assistant[]
  tenants: Tenant[]
  links: Link[]
  inboundTokens: WebhookToken[]
  isSuperAdmin: boolean
  currentUserId: string
}

const BASE_SUBTABS = [
  { id: 'assistenten', label: 'Assistenten beheer' },
  { id: 'webhooks',    label: 'Webhook tokens' },
  { id: 'gebruikers',  label: 'Gebruikers' },
]

const SUPERADMIN_SUBTABS = [
  { id: 'tenant-aanmaken', label: 'Tenant aanmaken' },
  { id: 'koppelingen',     label: 'Tenant koppelingen' },
]

export function AdminDashboard({ assistants, tenants, links, inboundTokens, isSuperAdmin, currentUserId }: AdminDashboardProps) {
  const subtabs = isSuperAdmin
    ? [...BASE_SUBTABS, ...SUPERADMIN_SUBTABS]
    : BASE_SUBTABS

  const [active, setActive] = useState('assistenten')
  const [showCreateTenant, setShowCreateTenant] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 60,
            background: toast.ok ? '#065F46' : '#991B1B', color: '#fff',
            padding: '10px 18px', borderRadius: 8, fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.msg}
        </div>
      )}

      {showCreateTenant && (
        <CreateTenantModal
          onClose={() => setShowCreateTenant(false)}
          onCreated={() => {
            window.location.reload()
          }}
          showToast={showToast}
        />
      )}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #EAECEF', marginBottom: 24 }}>
        {subtabs.map((tab) => (
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

      {active === 'assistenten' && (
        <AdminAssistants
          assistants={assistants}
          tenants={tenants}
          links={links}
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

      {active === 'gebruikers' && (
        <AdminUsers
          tenants={tenants}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUserId}
        />
      )}

      {active === 'koppelingen' && (
        <AdminTenantKoppelingen
          assistants={assistants}
          tenants={tenants}
          links={links}
        />
      )}

      {active === 'tenant-aanmaken' && (
        <div className="bg-white rounded-lg border border-slate-100 p-6">
          <h3 className="text-sm font-medium text-slate-900 mb-2">Nieuwe tenant aanmaken</h3>
          <p className="text-sm text-slate-500 mb-4">
            Maak een nieuwe organisatie aan met een beheerder. Na aanmaak kan de beheerder direct inloggen.
          </p>
          <button
            onClick={() => setShowCreateTenant(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 14px', borderRadius: 7,
              border: 'none', background: TEAL,
              fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Tenant aanmaken
          </button>
        </div>
      )}
    </div>
  )
}

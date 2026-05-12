'use client'

import { useState, useCallback } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import type { AssistantStatus } from '@/types'

const TEAL = '#1D9E75'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  createdAt: string
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

interface Props {
  assistants: Assistant[]
  tenants: Tenant[]
  links: Link[]
}

function SmallToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 32, height: 17, borderRadius: 9,
        border: 'none', padding: 0,
        background: checked ? TEAL : '#E2E8F0',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', width: 13, height: 13,
        borderRadius: '50%', background: '#fff',
        top: 2, left: checked ? 17 : 2,
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }} />
    </button>
  )
}

const headerCell: React.CSSProperties = {
  padding: '8px 10px', fontSize: 11, fontWeight: 600,
  color: '#64748B', whiteSpace: 'nowrap',
  borderBottom: '0.5px solid #E2E8F0',
  background: '#F8FAFC',
  position: 'sticky', top: 0, zIndex: 2,
  fontFamily: 'inherit',
}

export function AdminTenantKoppelingen({ assistants, tenants, links }: Props) {
  const [linkState, setLinkState] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const l of links) {
      map[`${l.assistantId}:${l.tenantId}`] = true
    }
    return map
  })
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const isLinked = useCallback(
    (assistantId: string, tenantId: string) =>
      linkState[`${assistantId}:${tenantId}`] === true,
    [linkState]
  )

  const countLinks = useCallback(
    (assistantId: string) =>
      tenants.filter((t) => isLinked(assistantId, t.id)).length,
    [tenants, isLinked]
  )

  const handleToggle = async (assistantId: string, tenantId: string) => {
    const key = `${assistantId}:${tenantId}`
    const currentlyLinked = linkState[key] === true
    const linkCount = countLinks(assistantId)

    if (currentlyLinked && linkCount <= 1) {
      showToast('Elke assistent moet minimaal aan 1 tenant gekoppeld zijn', false)
      return
    }

    const newValue = !currentlyLinked

    setLinkState((prev) => ({ ...prev, [key]: newValue }))
    setLoading(key)

    try {
      const res = await fetch('/api/admin/assistant-tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, tenantId, linked: newValue }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'Fout bij opslaan')
      }
      showToast(newValue ? 'Koppeling geactiveerd' : 'Koppeling verwijderd')
    } catch (err) {
      setLinkState((prev) => ({ ...prev, [key]: currentlyLinked }))
      showToast(err instanceof Error ? err.message : 'Opslaan mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  const th = (tenantName: string) => (
    <div key={`th-${tenantName}`} style={{
      ...headerCell,
      textAlign: 'center',
      minWidth: 100,
    }}>
      {tenantName}
    </div>
  )

  if (tenants.length === 0) {
    return (
      <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: 24 }}>
        Geen tenants beschikbaar
      </p>
    )
  }

  const emptyCell = (assistantId: string, tenantId: string) => {
    const linked = isLinked(assistantId, tenantId)
    const isLoading = loading === `${assistantId}:${tenantId}`

    return (
      <div key={`${assistantId}:${tenantId}`} style={{
        padding: '6px 10px', textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isLoading ? (
          <Loader2 size={13} color="#94A3B8" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <SmallToggle checked={linked} onChange={() => handleToggle(assistantId, tenantId)} />
        )}
      </div>
    )
  }

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: toast.ok ? '#0F172A' : '#EF4444',
          color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>
          Tenant koppelingen
        </h2>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
          Bepaal per assistent in welke tenants deze beschikbaar is. Minimaal 1 tenant per assistent.
        </p>
      </div>

      <div style={{
        background: '#fff', border: '0.5px solid #E2E8F0',
        borderRadius: 10, overflow: 'auto', maxHeight: '70vh',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `minmax(180px, 220px) repeat(${tenants.length}, minmax(100px, 1fr))`,
          minWidth: '100%',
        }}>
          <div style={headerCell}>
            Assistent
          </div>
          {tenants.map((t) => th(t.name))}

          {assistants.map((a) => {
            const rowCount = countLinks(a.id)
            return (
              <div key={a.id} style={{ display: 'contents' }}>
                <div style={{
                  padding: '10px 12px',
                  borderBottom: '0.5px solid #F1F5F9',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 500, color: '#0F172A',
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {a.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '1px 0 0' }}>
                      {a.type} · {rowCount} tenant{rowCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {rowCount === 1 && (
                    <span title="Minimum 1 tenant vereist" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      fontSize: 9, color: '#94A3B8',
                    }}>
                      <Lock size={10} />
                    </span>
                  )}
                </div>
                {tenants.map((t) => (
                  <div key={`${a.id}:${t.id}`} style={{
                    borderBottom: '0.5px solid #F1F5F9',
                  }}>
                    {emptyCell(a.id, t.id)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {assistants.length === 0 && (
        <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: 24 }}>
          Geen assistenten gevonden
        </p>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

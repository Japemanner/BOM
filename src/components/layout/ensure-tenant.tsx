'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export function EnsureTenant({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/ensure-tenant', { method: 'POST' })
      .then(async (res) => {
        if (!cancelled) {
          if (res.ok) {
            setState('ready')
          } else {
            const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
            setErrMsg((body as { error?: string }).error ?? 'Tenant initialisatie mislukt')
            setState('error')
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrMsg('Kan server niet bereiken')
          setState('error')
        }
      })

    return () => { cancelled = true }
  }, [])

  if (state === 'loading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, flex: 1,
      }}>
        <Loader2 size={22} color="#1D9E75" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Instellingen laden...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, flex: 1, padding: 24,
      }}>
        <AlertTriangle size={28} color="#EF4444" />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: '0 0 4px' }}>
            Tenant initialisatie mislukt
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, maxWidth: 400 }}>
            {errMsg ?? 'Onbekende fout'}
          </p>
        </div>
        <button
          onClick={() => { setState('loading'); setErrMsg(null); window.location.reload() }}
          style={{
            height: 30, padding: '0 14px', borderRadius: 7,
            background: '#F3F4F6', border: '0.5px solid #E2E8F0',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
          }}
        >
          Opnieuw proberen
        </button>
      </div>
    )
  }

  return <>{children}</>
}

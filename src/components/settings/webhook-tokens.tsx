// src/components/settings/webhook-tokens.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, Copy, Check, X } from 'lucide-react'

const TEAL = '#1D9E75'

interface WebhookToken {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

interface WebhookTokensProps {
  initial: WebhookToken[]
}

export function WebhookTokens({ initial }: WebhookTokensProps) {
  const [tokens, setTokens] = useState<WebhookToken[]>(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as WebhookToken & { token: string }
      setTokens((prev) => [...prev, { id: data.id, name: data.name, createdAt: data.createdAt, lastUsedAt: null }])
      setNewToken(data.token)
      setNewName('')
    } catch {
      setError('Aanmaken mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/webhooks/tokens/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setTokens((prev) => prev.filter((t) => t.id !== id))
      setConfirmDelete(null)
    } catch {
      setError('Verwijderen mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #EAECEF',
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>Webhook tokens</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
            Bearer tokens voor inkomende N8N webhooks
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewToken(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px', borderRadius: 6,
            background: TEAL, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} /> Nieuw token
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{error}</p>
      )}

      {showCreate && !newToken && (
        <div
          style={{
            background: '#F8FAFC', border: '0.5px solid #E2E8F0',
            borderRadius: 8, padding: 14, marginBottom: 14,
            display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Token naam, bijv. 'N8N productie'"
            style={{
              flex: 1, height: 32, padding: '0 10px',
              border: '1px solid #CBD5E1', borderRadius: 6,
              fontSize: 12, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            style={{
              height: 32, padding: '0 14px', borderRadius: 6,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              opacity: loading || !newName.trim() ? 0.5 : 1,
            }}
          >
            Aanmaken
          </button>
          <button
            onClick={() => setShowCreate(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {newToken && (
        <div
          style={{
            background: '#F0FDF4', border: '1px solid #86EFAC',
            borderRadius: 8, padding: 14, marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: '#166534', marginBottom: 8 }}>
            Token aangemaakt — kopieer het nu. Dit token wordt niet meer getoond.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              style={{
                flex: 1, fontSize: 11, background: '#fff',
                border: '1px solid #BBF7D0', borderRadius: 4,
                padding: '6px 10px', wordBreak: 'break-all', color: '#0F172A',
              }}
            >
              {newToken}
            </code>
            <button
              onClick={handleCopy}
              style={{
                height: 32, padding: '0 12px', borderRadius: 6,
                background: copied ? '#22C55E' : TEAL, color: '#fff', border: 'none',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              {copied ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
            </button>
            <button
              onClick={() => { setNewToken(null); setShowCreate(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
          Nog geen tokens aangemaakt
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid #EAECEF' }}>
              {['Naam', 'Aangemaakt', 'Laatste gebruik', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left', fontSize: 11, fontWeight: 500,
                    color: '#9CA3AF', padding: '0 0 8px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} style={{ borderBottom: '0.5px solid #F1F5F9' }}>
                <td style={{ fontSize: 12, color: '#0F172A', padding: '10px 0' }}>{t.name}</td>
                <td style={{ fontSize: 12, color: '#6B7280', padding: '10px 8px' }}>
                  {formatDate(t.createdAt)}
                </td>
                <td style={{ fontSize: 12, color: '#6B7280', padding: '10px 8px' }}>
                  {t.lastUsedAt ? formatDate(t.lastUsedAt) : '—'}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>
                  {confirmDelete === t.id ? (
                    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#EF4444' }}>Zeker?</span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={loading}
                        style={{
                          fontSize: 11, color: '#fff', background: '#EF4444',
                          border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                        }}
                      >
                        Ja
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          fontSize: 11, color: '#6B7280', background: '#F1F5F9',
                          border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                        }}
                      >
                        Nee
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(t.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#CBD5E1', padding: 4,
                      }}
                      title="Token intrekken"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

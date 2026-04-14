'use client'

import { useState } from 'react'
import {
  Plus, Trash2, Settings, Play, Pause, X, Save, Loader2,
} from 'lucide-react'
import type { AssistantStatus } from '@/types'

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  tenantId: string
  createdAt: string
  updatedAt?: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
}

interface AdminAssistantsProps {
  assistants: Assistant[]
  tenants: Tenant[]
}

const ASSISTANT_TYPES = [
  { value: 'redeneer', label: 'Redeneer' },
  { value: 'react',    label: 'ReAct' },
  { value: 'tekst',    label: 'Tekst' },
  { value: 'audio',    label: 'Audio' },
]

const ASSISTANT_SUBS = [
  { value: 'freelance', label: 'Freelance' },
  { value: 'mkb',       label: 'MKB' },
  { value: 'beide',     label: 'Beide' },
]

const statusLabel: Record<AssistantStatus, string> = {
  active: 'Actief',
  paused: 'Gepauzeerd',
  error: 'Fout',
}

const statusColor: Record<AssistantStatus, string> = {
  active: '#22C55E',
  paused: '#CBD5E1',
  error: '#EF4444',
}

interface EditForm {
  name: string
  description: string
  type: string
  sub: string
  webhook: string
  chatten: boolean
  bestandenUploaden: boolean
}

const emptyForm: EditForm = {
  name: '',
  description: '',
  type: 'redeneer',
  sub: 'beide',
  webhook: '',
  chatten: false,
  bestandenUploaden: false,
}

// ── Hulpcomponenten modal ──────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  borderRadius: 7,
  border: '0.5px solid #E2E8F0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#0F172A',
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ModalToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        border: 'none', padding: 0,
        background: checked ? '#1D9E75' : '#E2E8F0',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', width: 16, height: 16,
        borderRadius: '50%', background: '#fff',
        top: 2, left: checked ? 18 : 2,
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }} />
    </button>
  )
}

function ModalToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: '#94A3B8', margin: '1px 0 0' }}>{description}</p>
      </div>
      <ModalToggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ── Hoofdcomponent ─────────────────────────────────────────────────────────

export function AdminAssistants({ assistants: initial, tenants }: AdminAssistantsProps) {
  const [assistants, setAssistants] = useState<Assistant[]>(initial)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<EditForm>(emptyForm)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Toggle active/paused
  const handleToggle = async (a: Assistant) => {
    const newStatus: AssistantStatus = a.status === 'active' ? 'paused' : 'active'
    setLoading(a.id)
    try {
      const res = await fetch(`/api/assistants/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setAssistants((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: newStatus } : x))
      )
      showToast(`${a.name} is ${newStatus === 'active' ? 'geactiveerd' : 'gepauzeerd'}`)
    } catch {
      showToast('Wijziging mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  // Verwijderen
  const handleDelete = async (a: Assistant) => {
    if (!confirm(`Weet je zeker dat je "${a.name}" wilt verwijderen?`)) return
    setLoading(a.id + '_del')
    try {
      const res = await fetch(`/api/assistants/${a.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAssistants((prev) => prev.filter((x) => x.id !== a.id))
      showToast(`${a.name} verwijderd`)
    } catch {
      showToast('Verwijderen mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  // Bewerken openen
  const openEdit = (a: Assistant) => {
    setForm({
      name: a.name,
      description: a.description,
      type: a.type,
      sub: 'beide',
      webhook: '',
      chatten: false,
      bestandenUploaden: false,
    })
    setEditingId(a.id)
  }

  // Nieuw openen
  const openNew = () => {
    setForm(emptyForm)
    setEditingId('new')
  }

  // Opslaan (nieuw of update)
  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Naam is verplicht', false)
      return
    }
    setLoading('save')
    try {
      if (editingId === 'new') {
        const tenantId = tenants[0]?.id ?? '00000000-0000-0000-0000-000000000001'
        const res = await fetch('/api/assistants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            type: form.type,
            tenantId,
          }),
        })
        if (!res.ok) throw new Error()
        const created = (await res.json()) as Assistant
        setAssistants((prev) => [created, ...prev])
        showToast(`${created.name} aangemaakt`)
      } else {
        const res = await fetch(`/api/assistants/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, description: form.description, type: form.type }),
        })
        if (!res.ok) throw new Error()
        const updated = (await res.json()) as Assistant
        setAssistants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
        showToast(`${updated.name} opgeslagen`)
      }
      setEditingId(null)
    } catch {
      showToast('Opslaan mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  // Groepeer per tenant
  const byTenant = tenants.map((t) => ({
    tenant: t,
    items: assistants.filter((a) => a.tenantId === t.id),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: toast.ok ? '#0F172A' : '#EF4444',
          color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>
            Assistenten beheren
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
            Activeer, configureer of verwijder assistenten per tenant
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 34, padding: '0 14px', borderRadius: 8,
            background: '#3B82F6', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Nieuwe assistent
        </button>
      </div>

      {/* Per tenant */}
      {byTenant.map(({ tenant, items }) => (
        <div key={tenant.id}>
          {/* Tenant header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8, paddingBottom: 6,
            borderBottom: '0.5px solid #E2E8F0',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tenant.name}
            </span>
            <span style={{ fontSize: 10, color: '#CBD5E1', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
              {tenant.plan}
            </span>
            <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>
              {items.length} assistent{items.length !== 1 ? 'en' : ''}
            </span>
          </div>

          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: '#CBD5E1', padding: '8px 0' }}>
              Geen assistenten voor deze tenant
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#fff', border: '0.5px solid #E2E8F0',
                    borderRadius: 10, padding: '10px 14px',
                  }}
                >
                  {/* Status pip */}
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: statusColor[a.status], flexShrink: 0,
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '1px 0 0' }}>
                      {a.type} · {statusLabel[a.status]}
                      {a.description && ` · ${a.description}`}
                    </p>
                  </div>

                  {/* Acties */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(a)}
                      disabled={loading === a.id || a.status === 'error'}
                      title={a.status === 'active' ? 'Pauzeer' : 'Activeer'}
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: '0.5px solid #E2E8F0', background: '#F8FAFC',
                        cursor: a.status === 'error' ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: loading === a.id ? 0.5 : 1,
                      }}
                    >
                      {loading === a.id
                        ? <Loader2 size={12} color="#94A3B8" style={{ animation: 'spin 1s linear infinite' }} />
                        : a.status === 'active'
                        ? <Pause size={12} color="#64748B" />
                        : <Play size={12} color="#22C55E" />
                      }
                    </button>

                    {/* Instellingen */}
                    <button
                      onClick={() => openEdit(a)}
                      title="Instellingen"
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: '0.5px solid #E2E8F0', background: '#F8FAFC',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Settings size={12} color="#64748B" />
                    </button>

                    {/* Verwijderen */}
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={loading === a.id + '_del'}
                      title="Verwijderen"
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        border: '0.5px solid #FECACA', background: '#FEF2F2',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: loading === a.id + '_del' ? 0.5 : 1,
                      }}
                    >
                      {loading === a.id + '_del'
                        ? <Loader2 size={12} color="#EF4444" />
                        : <Trash2 size={12} color="#EF4444" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {tenants.length === 0 && (
        <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: 24 }}>
          Nog geen tenants aangemaakt
        </p>
      )}

      {/* Edit / Nieuw modal */}
      {editingId !== null && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>
                {editingId === 'new' ? 'Nieuwe assistent' : 'Assistent bewerken'}
              </h3>
              <button
                onClick={() => setEditingId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={16} color="#94A3B8" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Naam */}
              <FormField label="Naam *">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Bijv. Factuurverwerker"
                  style={fieldStyle}
                />
              </FormField>

              {/* Beschrijving */}
              <FormField label="Beschrijving">
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Korte omschrijving van de taak"
                  style={fieldStyle}
                />
              </FormField>

              {/* Webhook */}
              <FormField label="Webhook (n8n)">
                <input
                  value={form.webhook}
                  onChange={(e) => setForm((f) => ({ ...f, webhook: e.target.value }))}
                  placeholder="https://n8n.jouwdomein.nl/webhook/..."
                  type="url"
                  style={fieldStyle}
                />
              </FormField>

              {/* Type + Sub naast elkaar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormField label="Type">
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    style={{ ...fieldStyle, background: '#fff', cursor: 'pointer' }}
                  >
                    {ASSISTANT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Sub">
                  <select
                    value={form.sub}
                    onChange={(e) => setForm((f) => ({ ...f, sub: e.target.value }))}
                    style={{ ...fieldStyle, background: '#fff', cursor: 'pointer' }}
                  >
                    {ASSISTANT_SUBS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '0.5px solid #F1F5F9' }} />

              {/* Toggles */}
              <ModalToggleRow
                label="Chatten"
                description="Gebruiker kan berichten sturen"
                checked={form.chatten}
                onChange={(v) => setForm((f) => ({ ...f, chatten: v }))}
              />
              <ModalToggleRow
                label="Bestanden uploaden"
                description="Gebruiker kan bijlagen meesturen"
                checked={form.bestandenUploaden}
                onChange={(v) => setForm((f) => ({ ...f, bestandenUploaden: v }))}
              />

            </div>

            {/* Knoppen */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingId(null)}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 7,
                  border: '1px solid #E2E8F0', background: '#fff',
                  fontSize: 13, cursor: 'pointer', color: '#64748B',
                }}
              >
                Annuleren
              </button>
              <button
                onClick={handleSave}
                disabled={loading === 'save'}
                style={{
                  height: 34, padding: '0 16px', borderRadius: 7,
                  background: '#3B82F6', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: loading === 'save' ? 0.7 : 1,
                }}
              >
                {loading === 'save'
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan...</>
                  : <><Save size={12} /> Opslaan</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

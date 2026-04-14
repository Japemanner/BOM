'use client'

import { useState } from 'react'
import {
  FileText, Mail, FileCheck, UserCheck, AlignLeft, Send, Bot,
  Play, Pause, Settings, Trash2, Loader2, Plus, X, Save,
} from 'lucide-react'
import { useAssistantsStore } from '@/store/assistants-store'
import type { AssistantStatus } from '@/types'

async function logEvent(
  assistantId: string,
  assistantName: string,
  eventType: 'activated' | 'deactivated'
) {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistantId, assistantName, eventType }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    console.error('[logEvent] kon event niet loggen:', { assistantId, assistantName, eventType, error })
  }
}

const TEAL = '#1D9E75'

// ── Types ─────────────────────────────────────────────────────────────────

interface ManagedAssistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
  source: 'demo' | 'db'      // demo = dashboard mock, db = echte data
  tenantId?: string
}

interface EditForm {
  name: string
  description: string
  type: string
  sub: string
  interactie: string
  webhook: string
  chatten: boolean
  bestandenUploaden: boolean
  offline: boolean
}

// ── Gedeelde mock-data (zelfde als "Mijn assistenten" dashboard) ───────────

const DEMO_ASSISTANTS: ManagedAssistant[] = [
  {
    id: 'demo-1', source: 'demo', status: 'active',  runsToday: 23,
    name: 'Factuurverwerker',
    description: 'Verwerkt inkomende UBL-facturen automatisch',
    type: 'factuur',
  },
  {
    id: 'demo-2', source: 'demo', status: 'active', runsToday: 18,
    name: 'E-mail classifier',
    description: 'Categoriseert klantvragen op onderwerp',
    type: 'email',
  },
  {
    id: 'demo-3', source: 'demo', status: 'error', runsToday: 0,
    name: 'Exact sync',
    description: 'Synchroniseert boekingen met Exact Online',
    type: 'ubl',
    lastError: 'API token verlopen',
  },
  {
    id: 'demo-4', source: 'demo', status: 'active', runsToday: 6,
    name: 'Rapportage bot',
    description: 'Genereert wekelijkse managementrapporten',
    type: 'rapport',
  },
  {
    id: 'demo-5', source: 'demo', status: 'paused', runsToday: 0,
    name: 'Contract checker',
    description: 'Controleert contracten op aflopende datums',
    type: 'contract',
  },
]

// ── Constanten ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  factuur:    { icon: FileText,  label: 'Factuur' },
  email:      { icon: Mail,      label: 'E-mail' },
  contract:   { icon: FileCheck, label: 'Contract' },
  onboarding: { icon: UserCheck, label: 'Onboarding' },
  rapport:    { icon: AlignLeft, label: 'Rapport' },
  ubl:        { icon: Send,      label: 'UBL' },
  redeneer:   { icon: Bot,       label: 'Redeneer' },
  react:      { icon: Bot,       label: 'ReAct' },
  tekst:      { icon: FileText,  label: 'Tekst' },
  audio:      { icon: Send,      label: 'Audio' },
  custom:     { icon: Bot,       label: 'Overig' },
}

const ASSISTANT_TYPES = [
  { value: 'redeneer', label: 'Redeneer' },
  { value: 'react',    label: 'ReAct' },
  { value: 'tekst',    label: 'Tekst' },
  { value: 'audio',    label: 'Audio' },
  { value: 'factuur',  label: 'Factuur' },
  { value: 'email',    label: 'E-mail' },
  { value: 'contract', label: 'Contract' },
  { value: 'rapport',  label: 'Rapport' },
  { value: 'ubl',      label: 'UBL' },
  { value: 'custom',   label: 'Overig' },
]

const ASSISTANT_SUBS        = ['Freelance', 'MKB', 'Beide']
const ASSISTANT_INTERACTIES = ['Web only', 'Integratie', 'Beide']

const STATUS_COLOR: Record<AssistantStatus, string> = {
  active: TEAL,
  paused: '#D1D5DB',
  error:  '#EF4444',
}

const STATUS_LABEL: Record<AssistantStatus, string> = {
  active: 'Actief',
  paused: 'Gepauzeerd',
  error:  'Fout',
}

const EMPTY_FORM: EditForm = {
  name: '', description: '', type: 'redeneer',
  sub: 'Beide', interactie: 'Web only',
  webhook: '', chatten: false, bestandenUploaden: false, offline: false,
}

// ── Hulpcomponenten ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px',
  borderRadius: 7, border: '0.5px solid #E2E8F0',
  fontSize: 12, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', color: '#0F172A', background: '#fff',
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SmallToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 32, height: 17, borderRadius: 9, border: 'none', padding: 0,
        background: checked ? TEAL : '#E2E8F0',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', width: 13, height: 13, borderRadius: '50%',
        background: '#fff', top: 2, left: checked ? 17 : 2,
        transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }} />
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────

function EditModal({
  assistant,
  isNew,
  form,
  onFormChange,
  onSave,
  onClose,
  isSaving,
}: {
  assistant: ManagedAssistant | null
  isNew: boolean
  form: EditForm
  onFormChange: (f: EditForm) => void
  onSave: () => void
  onClose: () => void
  isSaving: boolean
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, width: 460, maxWidth: '92vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: 0 }}>
            {isNew ? 'Nieuwe assistent' : `${assistant?.name ?? ''} bewerken`}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          <ModalField label="Naam *">
            <input value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="Bijv. Factuurverwerker" style={inputStyle} />
          </ModalField>

          <ModalField label="Beschrijving">
            <input value={form.description} onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              placeholder="Korte omschrijving van de taak" style={inputStyle} />
          </ModalField>

          <ModalField label="Webhook (n8n)">
            <input value={form.webhook} onChange={(e) => onFormChange({ ...form, webhook: e.target.value })}
              placeholder="https://n8n.jouwdomein.nl/webhook/..." type="url" style={inputStyle} />
          </ModalField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <ModalField label="Type">
              <select value={form.type} onChange={(e) => onFormChange({ ...form, type: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {ASSISTANT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </ModalField>
            <ModalField label="Sub">
              <select value={form.sub} onChange={(e) => onFormChange({ ...form, sub: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {ASSISTANT_SUBS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </ModalField>
            <ModalField label="Interactie">
              <select value={form.interactie} onChange={(e) => onFormChange({ ...form, interactie: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {ASSISTANT_INTERACTIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </ModalField>
          </div>

          <div style={{ borderTop: '0.5px solid #F1F5F9', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'chatten',           label: 'Chatten',             desc: 'Gebruiker kan berichten sturen' },
              { key: 'bestandenUploaden', label: 'Bestanden uploaden',  desc: 'Gebruiker kan bijlagen meesturen' },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>{desc}</p>
                </div>
                <SmallToggle
                  checked={form[key as keyof EditForm] as boolean}
                  onChange={(v) => onFormChange({ ...form, [key]: v })}
                />
              </div>
            ))}
          </div>

          {/* Offline zetten */}
          <div style={{
            borderTop: '0.5px solid #FEE2E2', paddingTop: 12,
            background: form.offline ? '#FFF5F5' : 'transparent',
            borderRadius: form.offline ? 8 : 0,
            padding: form.offline ? '10px 12px' : '12px 0 0',
            transition: 'background 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: form.offline ? '#DC2626' : '#0F172A', margin: 0 }}>
                  Assistent offline zetten
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>
                  {form.offline ? 'Assistent is niet bereikbaar voor gebruikers' : 'Assistent is actief en bereikbaar'}
                </p>
              </div>
              <SmallToggle
                checked={form.offline}
                onChange={(v) => onFormChange({ ...form, offline: v })}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '0.5px solid #F1F5F9' }}>
          <button onClick={onClose} style={{
            height: 32, padding: '0 14px', borderRadius: 7,
            border: '0.5px solid #E2E8F0', background: '#fff',
            fontSize: 12, cursor: 'pointer', color: '#64748B', fontFamily: 'inherit',
          }}>
            Annuleren
          </button>
          <button onClick={onSave} disabled={isSaving} style={{
            height: 32, padding: '0 16px', borderRadius: 7,
            background: TEAL, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: isSaving ? 0.6 : 1, fontFamily: 'inherit',
          }}>
            {isSaving
              ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan...</>
              : <><Save size={11} /> Opslaan</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hoofd component ───────────────────────────────────────────────────────

interface AssistentenBeheerProps {
  dbAssistants: ManagedAssistant[]
}

export function AssistentenBeheer({ dbAssistants }: AssistentenBeheerProps) {
  const { statusOverrides, deletedIds, setStatus, markDeleted } = useAssistantsStore()

  // Combineer demo + db assistenten, pas store-overrides toe en filter verwijderde
  const [assistants, setAssistants] = useState<ManagedAssistant[]>(() =>
    [...DEMO_ASSISTANTS, ...dbAssistants]
      .filter((a) => !deletedIds.includes(a.id))
      .map((a) => ({
        ...a,
        status: statusOverrides[a.id] ?? a.status,
      }))
  )

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const openEdit = (a: ManagedAssistant) => {
    setForm({ ...EMPTY_FORM, name: a.name, description: a.description, type: a.type, offline: a.status !== 'active' })
    setEditingId(a.id)
  }

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditingId('new')
  }

  const handleToggle = async (a: ManagedAssistant) => {
    const newStatus: AssistantStatus = a.status === 'active' ? 'paused' : 'active'
    // Optimistisch updaten in lokale state én store (voor dashboard)
    setAssistants((prev) => prev.map((x) => x.id === a.id ? { ...x, status: newStatus } : x))
    setStatus(a.id, newStatus)
    // Fire-and-forget: log event naar database
    void logEvent(a.id, a.name, newStatus === 'active' ? 'activated' : 'deactivated')
    if (a.source === 'db') {
      setLoading(a.id)
      try {
        const res = await fetch(`/api/assistants/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!res.ok) throw new Error()
      } catch {
        // Terugdraaien
        setAssistants((prev) => prev.map((x) => x.id === a.id ? { ...x, status: a.status } : x))
        setStatus(a.id, a.status)
        showToast('Wijziging mislukt', false)
      } finally {
        setLoading(null)
      }
    }
    showToast(`${a.name} ${newStatus === 'active' ? 'geactiveerd' : 'gepauzeerd'}`)
  }

  const handleDelete = async (a: ManagedAssistant) => {
    if (!confirm(`Weet je zeker dat je "${a.name}" wilt verwijderen?`)) return
    setAssistants((prev) => prev.filter((x) => x.id !== a.id))
    // Sla verwijdering op in store zodat hij na refresh niet terugkomt
    markDeleted(a.id)
    if (a.source === 'db') {
      setLoading(a.id + '_del')
      try {
        const res = await fetch(`/api/assistants/${a.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
      } catch {
        setAssistants((prev) => [...prev, a])
        showToast('Verwijderen mislukt', false)
        return
      } finally {
        setLoading(null)
      }
    }
    showToast(`${a.name} verwijderd`)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Naam is verplicht', false); return }
    setLoading('save')
    try {
      if (editingId === 'new') {
        const res = await fetch('/api/assistants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name, description: form.description, type: form.type,
            tenantId: '00000000-0000-0000-0000-000000000001',
          }),
        })
        if (!res.ok) throw new Error()
        const created = await res.json() as ManagedAssistant
        setAssistants((prev) => [...prev, { ...created, source: 'db', runsToday: 0 }])
        showToast(`${created.name} aangemaakt`)
      } else if (editingId) {
        const a = assistants.find((x) => x.id === editingId)
        const newStatus: AssistantStatus = form.offline ? 'paused' : 'active'
        if (a?.source === 'db') {
          const res = await fetch(`/api/assistants/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name, description: form.description, type: form.type, status: newStatus }),
          })
          if (!res.ok) throw new Error()
        }
        // Sla status op in store zodat dashboard direct reageert
        setStatus(editingId, newStatus)
        // Log alleen als de status daadwerkelijk wijzigt
        const currentStatus = assistants.find((x) => x.id === editingId)?.status
        if (currentStatus !== newStatus) {
          void logEvent(editingId, form.name, newStatus === 'active' ? 'activated' : 'deactivated')
        }
        setAssistants((prev) => prev.map((x) =>
          x.id === editingId ? { ...x, name: form.name, description: form.description, type: form.type, status: newStatus } : x
        ))
        showToast(`${form.name} opgeslagen`)
      }
      setEditingId(null)
    } catch {
      showToast('Opslaan mislukt', false)
    } finally {
      setLoading(null)
    }
  }

  // Sorteer: error → active → paused
  const ORDER: Record<AssistantStatus, number> = { error: 0, active: 1, paused: 2 }
  const sorted = [...assistants].sort((a, b) => (ORDER[a.status] ?? 2) - (ORDER[b.status] ?? 2))

  const editingAssistant = editingId && editingId !== 'new'
    ? (assistants.find((a) => a.id === editingId) ?? null)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>
            Alle assistenten
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            {assistants.filter((a) => a.status === 'active').length} actief · {assistants.length} totaal
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 14px', borderRadius: 8,
            background: TEAL, color: '#fff', border: 'none',
            fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          Nieuwe assistent
        </button>
      </div>

      {/* Lijst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((a) => {
          const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG['custom']!
          const Icon = cfg.icon
          const isActive = a.status === 'active'

          return (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', border: '0.5px solid #EAECEF',
                borderRadius: 10, padding: '10px 14px',
                opacity: a.status === 'paused' ? 0.7 : 1,
              }}
            >
              {/* Icoon */}
              <div style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                background: isActive ? '#ECFDF5' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} color={isActive ? TEAL : '#9CA3AF'} strokeWidth={1.75} />
              </div>

              {/* Status dot */}
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: STATUS_COLOR[a.status], flexShrink: 0,
              }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </p>
                  {a.source === 'demo' && (
                    <span style={{ fontSize: 9, fontWeight: 500, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>
                      DEMO
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cfg.label}
                  {a.description ? ` · ${a.description}` : ''}
                  {a.status === 'error' && a.lastError ? ` · ⚠ ${a.lastError}` : ''}
                </p>
              </div>

              {/* Status badge */}
              <span style={{
                fontSize: 10, fontWeight: 500, flexShrink: 0,
                color: isActive ? TEAL : a.status === 'error' ? '#EF4444' : '#9CA3AF',
                background: isActive ? '#ECFDF5' : a.status === 'error' ? '#FEF2F2' : '#F3F4F6',
                padding: '2px 7px', borderRadius: 5,
              }}>
                {STATUS_LABEL[a.status]}
              </span>

              {/* Acties */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(a)}
                  disabled={loading === a.id || a.status === 'error'}
                  title={a.status === 'active' ? 'Pauzeer' : 'Activeer'}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: '0.5px solid #EAECEF',
                    background: '#F8FAFC', cursor: a.status === 'error' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: loading === a.id ? 0.5 : 1,
                  }}
                >
                  {loading === a.id
                    ? <Loader2 size={11} color="#9CA3AF" style={{ animation: 'spin 1s linear infinite' }} />
                    : a.status === 'active'
                    ? <Pause size={11} color="#6B7280" />
                    : <Play size={11} color={TEAL} />
                  }
                </button>

                {/* Bewerken */}
                <button
                  onClick={() => openEdit(a)}
                  title="Bewerken"
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: '0.5px solid #EAECEF',
                    background: '#F8FAFC', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Settings size={11} color="#6B7280" />
                </button>

                {/* Verwijderen */}
                <button
                  onClick={() => handleDelete(a)}
                  disabled={loading === a.id + '_del'}
                  title="Verwijderen"
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: '0.5px solid #FECACA', background: '#FEF2F2',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: loading === a.id + '_del' ? 0.5 : 1,
                  }}
                >
                  {loading === a.id + '_del'
                    ? <Loader2 size={11} color="#EF4444" />
                    : <Trash2 size={11} color="#EF4444" />
                  }
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {assistants.length === 0 && (
        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '24px 0' }}>
          Nog geen assistenten aangemaakt
        </p>
      )}

      {/* Modal */}
      {editingId !== null && (
        <EditModal
          assistant={editingAssistant}
          isNew={editingId === 'new'}
          form={form}
          onFormChange={setForm}
          onSave={handleSave}
          onClose={() => setEditingId(null)}
          isSaving={loading === 'save'}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 400,
          background: toast.ok ? '#111827' : '#EF4444',
          color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

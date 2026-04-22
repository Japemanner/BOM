'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Zap,
  Loader2,
  Send,
  Bot,
} from 'lucide-react'
import { AssistantCard } from './assistant-card'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { useAssistantsStore } from '@/store/assistants-store'
import type { AssistantStatus } from '@/types'
import type { MetricsData } from './metrics-strip'

const TEAL = '#1D9E75'

// ── Types ────────────────────────────────────────────────────────────────────

interface Assistant {
  id: string
  name: string
  description: string
  type: string
  status: AssistantStatus
  runsToday: number
  lastError?: string
  tags?: string[]
}

interface ConfigForm {
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  memory: boolean
  webSearch: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { value: 'mistral-small-3.2', label: 'Mistral Small 3.2 (EU)' },
  { value: 'mistral-large-2',   label: 'Mistral Large 2 (EU)' },
  { value: 'llama-3.3-70b',     label: 'Llama 3.3 70B (EU)' },
  { value: 'claude-haiku-4.5',  label: 'Claude Haiku 4.5' },
]

const EMPTY_FORM: ConfigForm = {
  name: '',
  description: '',
  systemPrompt: '',
  model: 'mistral-small-3.2',
  temperature: 0.7,
  memory: true,
  webSearch: false,
}

// ── API ───────────────────────────────────────────────────────────────────────

async function patchAssistantStatus(id: string, status: 'active' | 'paused') {
  const res = await fetch(`/api/assistants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('PATCH mislukt')
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 34, height: 18, borderRadius: 9, border: 'none',
        background: checked ? TEAL : '#E5E7EB',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', width: 14, height: 14,
        borderRadius: '50%', background: '#fff',
        top: 2, left: checked ? 18 : 2,
        transition: 'left 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', height: 30, padding: '0 10px',
  borderRadius: 7, border: '0.5px solid #E5E7EB',
  fontSize: 12, outline: 'none', boxSizing: 'border-box',
  background: '#fff', color: '#111827', fontFamily: 'inherit',
}

function SmallToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
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

function Field({ label, rightLabel, children }: { label: string; rightLabel?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block' }}>{label}</label>
        {rightLabel !== undefined && (
          <span style={{ fontSize: 11, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{rightLabel}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
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

// ── Chat Window ─────────────────────────────────────────────────────────────

function ChatWindow({
  assistant,
  onClose,
}: {
  assistant: Assistant
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hallo! Ik ben ${assistant.name}. Hoe kan ik je vandaag helpen?`,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Placeholder: vraag later aansluiten op API
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Dit is een placeholder-antwoord — aansluiting op LLM API komt binnenkort.',
          timestamp: new Date().toISOString(),
        },
      ])
      setLoading(false)
    }, 1200)
  }

  return (
    <div
      style={{
        width: 340, flexShrink: 0, borderLeft: '0.5px solid #EAECEF',
        display: 'flex', flexDirection: 'column', background: '#FAFBFC',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 14px 12px', borderBottom: '0.5px solid #EAECEF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: '#ECFDF5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={14} color={TEAL} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>{assistant.name}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{assistant.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: msg.role === 'user' ? '#3B82F6' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#0F172A',
              padding: '8px 12px', borderRadius: 12,
              fontSize: 12, lineHeight: 1.45,
              border: msg.role === 'user' ? 'none' : '0.5px solid #EAECEF',
            }}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', fontSize: 11, color: '#9CA3AF', padding: '4px 8px' }}>
            <span style={{ display: 'inline-block', animation: 'pulse 1.4s infinite' }}>...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid #EAECEF', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Typ een bericht..."
            disabled={loading}
            style={{
              flex: 1, height: 34, padding: '0 10px',
              borderRadius: 7, border: '0.5px solid #E2E8F0',
              fontSize: 12, outline: 'none', fontFamily: 'inherit',
              background: '#fff', color: '#0F172A',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: 32, height: 32, borderRadius: 7,
              border: 'none', background: TEAL, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  )
}

// ── Config Panel (enkel voor "Nieuw") ──────────────────────────────────────

function ConfigPanel({
  assistant,
  form,
  onFormChange,
  onToggleActive,
  onSave,
  onClose,
  isSaving,
}: {
  assistant: Assistant | null
  form: ConfigForm
  onFormChange: (form: ConfigForm) => void
  onToggleActive: (newStatus: 'active' | 'paused') => void
  onSave: () => void
  onClose: () => void
  isSaving: boolean
}) {
  return (
    <div
      style={{
        width: 260, flexShrink: 0, borderLeft: '0.5px solid #EAECEF',
        display: 'flex', flexDirection: 'column', background: '#FAFBFC',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 14px 12px', borderBottom: '0.5px solid #EAECEF',
        display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {form.name || 'Nieuwe assistent'}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            {assistant ? `Bewerken` : 'Instellen en opslaan'}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF' }}>
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <ModalField label="Naam *">
            <input value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} placeholder="Assistent naam" style={{ ...INPUT_STYLE, height: 34 }} />
          </ModalField>

          <ModalField label="Systeemprompt">
            <textarea value={form.systemPrompt} onChange={(e) => onFormChange({ ...form, systemPrompt: e.target.value })}
              placeholder="Je bent een behulpzame assistent die..."
              style={{ ...INPUT_STYLE, height: 64, resize: 'none', padding: '7px 10px' }} />
          </ModalField>

          <ModalField label="Taalmodel">
            <select value={form.model} onChange={(e) => onFormChange({ ...form, model: e.target.value })}
              style={{ ...INPUT_STYLE, height: 34, background: '#fff', cursor: 'pointer' }}>
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </ModalField>

          <Field label="Temperatuur" rightLabel={form.temperature.toFixed(1)}>
            <input type="range" min="0" max="1" step="0.1" value={form.temperature}
              onChange={(e) => onFormChange({ ...form, temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: TEAL, cursor: 'pointer', margin: '4px 0 0' }} />
          </Field>

          <div style={{ borderTop: '0.5px solid #EAECEF' }} />

          <ToggleRow label="Geheugen" checked={form.memory} onChange={(v) => onFormChange({ ...form, memory: v })} />
          <ToggleRow label="Webzoeken" checked={form.webSearch} onChange={(v) => onFormChange({ ...form, webSearch: v })} />
          {assistant && (
            <ToggleRow label="Actief" checked={assistant.status === 'active'}
              onChange={(v) => onToggleActive(v ? 'active' : 'paused')} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '0.5px solid #EAECEF', display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            height: 34, borderRadius: 7, border: 'none',
            background: TEAL, color: '#fff', fontSize: 12, fontWeight: 500,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: isSaving ? 0.6 : 1, fontFamily: 'inherit',
          }}
        >
          {isSaving ? (
            <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan...</>
          ) : (
            <><Zap size={12} strokeWidth={2.5} /> {assistant ? 'Opslaan' : 'Aanmaken'}</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

interface AssistantDashboardProps {
  metrics: MetricsData
  assistants: Assistant[]
}

export function AssistantDashboard({
  metrics,
  assistants: initial,
}: AssistantDashboardProps) {
  const [localAssistants, setLocalAssistants] = useState<Assistant[]>(initial)
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [chatMode, setChatMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const { statusOverrides } = useAssistantsStore()

  const assistantsWithOverrides = useMemo(
    () => localAssistants.map((a) => ({
      ...a,
      status: (statusOverrides[a.id] ?? a.status) as AssistantStatus,
    })),
    [localAssistants, statusOverrides]
  )

  const { states, toggle, errorMessage, clearError } = useOptimisticToggle(
    assistantsWithOverrides.map((a) => ({ id: a.id, status: a.status })),
    patchAssistantStatus
  )

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleCardClick = useCallback(
    (id: string) => {
      const a = localAssistants.find((x) => x.id === id)
      if (!a) return
      setSelectedId(id)
      setChatMode(true)
      setConfigForm({
        name: a.name,
        description: a.description ?? '',
        systemPrompt: '',
        model: 'mistral-small-3.2',
        temperature: 0.7,
        memory: true,
        webSearch: false,
      })
    },
    [localAssistants]
  )

  const handleNew = useCallback(() => {
    setSelectedId('new')
    setChatMode(false)
    setConfigForm({ ...EMPTY_FORM })
  }, [])

  const handleToggleActive = useCallback(
    async (newStatus: 'active' | 'paused') => {
      if (!selectedId || selectedId === 'new') return
      await toggle(selectedId, newStatus)
    },
    [selectedId, toggle]
  )

  const handleSave = useCallback(async () => {
    if (!configForm.name.trim()) {
      showToast('Naam is verplicht', false)
      return
    }
    setIsSaving(true)
    try {
      if (selectedId === 'new') {
        const res = await fetch('/api/assistants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: configForm.name,
            description: configForm.description,
            type: 'custom',
          }),
        })
        if (!res.ok) throw new Error()
        const created = (await res.json()) as Assistant
        setLocalAssistants((prev) => [created, ...prev])
        setSelectedId(created.id)
        setChatMode(true)
        showToast(`${created.name} aangemaakt`)
      } else if (selectedId) {
        const res = await fetch(`/api/assistants/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: configForm.name,
            description: configForm.description,
          }),
        })
        if (!res.ok) throw new Error()
        const updated = (await res.json()) as Assistant
        setLocalAssistants((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? { ...a, name: updated.name, description: updated.description }
              : a
          )
        )
        showToast(`${updated.name} opgeslagen`)
      }
    } catch {
      showToast('Opslaan mislukt', false)
    } finally {
      setIsSaving(false)
    }
  }, [selectedId, configForm, showToast])

  const handleClose = useCallback(() => {
    setSelectedId(null)
    setChatMode(false)
  }, [])

  const displayed = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const withStatus = assistantsWithOverrides.map((a) => ({
      ...a,
      status: (states.get(a.id) ?? a.status) as AssistantStatus,
    }))

    const visible = withStatus.filter((a) => a.status !== 'paused')

    const filtered = q
      ? visible.filter((a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        )
      : visible

    const ORDER: Record<AssistantStatus, number> = { error: 0, active: 1, paused: 2 }
    return [...filtered].sort(
      (a, b) => (ORDER[a.status] ?? 2) - (ORDER[b.status] ?? 2)
    )
  }, [assistantsWithOverrides, searchQuery, states])

  const activeCount = [...states.values()].filter((s) => s === 'active').length
  const errorAssistants = localAssistants.filter(
    (a) => (states.get(a.id) ?? a.status) === 'error'
  )

  const selectedAssistant =
    selectedId && selectedId !== 'new'
      ? (localAssistants.find((a) => a.id === selectedId) ?? null)
      : null

  const selectedStatus =
    selectedId && selectedId !== 'new'
      ? (states.get(selectedId) ?? selectedAssistant?.status ?? null)
      : null

  const savedHours = (metrics.savedMinutes / 60).toFixed(1)

  const activeToast = toast?.msg ?? (errorMessage ?? null)
  const toastIsError = toast?.ok === false || (errorMessage !== null && toast === null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 52, background: '#fff', borderBottom: '0.5px solid #EAECEF',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', flexShrink: 0 }}>
          Mijn assistenten
        </span>

        <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
          <Search size={13} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Doorzoek assistenten..."
            style={{
              width: '100%', height: 32, paddingLeft: 32, paddingRight: 12,
              border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 12,
              outline: 'none', boxSizing: 'border-box', color: '#374151',
              background: '#F9FAFB', fontFamily: 'inherit',
            }}
          />
        </div>

        <button
          onClick={handleNew}
          style={{
            marginLeft: 'auto', height: 32, padding: '0 14px', borderRadius: 8,
            background: TEAL, color: '#fff', border: 'none', fontSize: 12,
            fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 6, flexShrink: 0, fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          Nieuw
        </button>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: scrollable content */}
        <div
          style={{
            flex: 1, overflowY: 'auto', padding: '18px 20px 24px', minWidth: 0,
          }}
        >
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'bespaard vandaag', value: `${savedHours}u` },
              { label: 'actief', value: `${activeCount} van ${metrics.totalCount}` },
              { label: 'taken vandaag', value: String(metrics.runsToday) },
            ].map((m) => (
              <div key={m.label} style={{ background: '#fff', border: '0.5px solid #EAECEF', borderRadius: 10, padding: '11px 14px' }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 5px', textTransform: 'lowercase' }}>{m.label}</p>
                <p style={{ fontSize: 20, fontWeight: 500, color: '#0F172A', margin: 0, lineHeight: 1 }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Error alerts */}
          {errorAssistants.map((a) => (
            <div key={a.id} style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#B91C1C', flex: 1 }}>
                <strong>{a.name}</strong> staat uit — {a.lastError ?? 'verbindingsfout'}
              </span>
              <ChevronRight size={13} color="#B91C1C" />
            </div>
          ))}

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Assistenten
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{activeCount} actief</span>
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {displayed.map((a) => {
              const st = states.get(a.id) ?? a.status
              return (
                <AssistantCard
                  key={a.id}
                  {...a}
                  status={st}
                  isSelected={selectedId === a.id}
                  onClick={handleCardClick}
                />
              )
            })}
          </div>

          {displayed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
              {searchQuery ? `Geen resultaten voor "${searchQuery}"` : 'Nog geen assistenten'}
            </div>
          )}

          {/* Historie */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Historie
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Recent activiteit wordt hier getoond.</p>
          </div>
        </div>

        {/* Right: chat window of config panel */}
        {selectedId === 'new' && (
          <ConfigPanel
            assistant={null}
            form={configForm}
            onFormChange={setConfigForm}
            onToggleActive={handleToggleActive}
            onSave={handleSave}
            onClose={handleClose}
            isSaving={isSaving}
          />
        )}
        {selectedId !== 'new' && selectedId !== null && selectedAssistant && chatMode && (
          <ChatWindow assistant={selectedAssistant} onClose={handleClose} />
        )}
        {selectedId !== 'new' && selectedId !== null && selectedAssistant && !chatMode && (
          <ConfigPanel
            assistant={{ ...selectedAssistant, status: (selectedStatus ?? selectedAssistant.status) as AssistantStatus }}
            form={configForm}
            onFormChange={setConfigForm}
            onToggleActive={handleToggleActive}
            onSave={handleSave}
            onClose={handleClose}
            isSaving={isSaving}
          />
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {activeToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toastIsError ? '#EF4444' : '#111827', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {activeToast}
          <button onClick={() => { setToast(null); clearError() }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

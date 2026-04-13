'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Star,
  ChevronRight,
  X,
  Zap,
  Loader2,
} from 'lucide-react'
import { AssistantCard } from './assistant-card'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  { value: 'mistral-small-3.2', label: 'Mistral Small 3.2 (EU)' },
  { value: 'mistral-large-2',   label: 'Mistral Large 2 (EU)' },
  { value: 'llama-3.3-70b',     label: 'Llama 3.3 70B (EU)' },
  { value: 'claude-haiku-4.5',  label: 'Claude Haiku 4.5' },
]

const TEMPLATE_CHIPS = [
  { emoji: '💬', label: 'Klantenservice' },
  { emoji: '📄', label: 'Offerte' },
  { emoji: '❓', label: 'FAQ bot' },
  { emoji: '📊', label: 'Data analist' },
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
        width: 34,
        height: 18,
        borderRadius: 9,
        border: 'none',
        background: checked ? TEAL : '#E5E7EB',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          top: 2,
          left: checked ? 18 : 2,
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 30,
  padding: '0 10px',
  borderRadius: 7,
  border: '0.5px solid #E5E7EB',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
  color: '#111827',
  fontFamily: 'inherit',
}

function Field({
  label,
  rightLabel,
  children,
}: {
  label: string
  rightLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 5,
          alignItems: 'center',
        }}
      >
        <label
          style={{ fontSize: 11, fontWeight: 500, color: '#374151', display: 'block' }}
        >
          {label}
        </label>
        {rightLabel !== undefined && (
          <span style={{ fontSize: 11, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {rightLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// ── Config Panel ──────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  selectedId: string | 'new' | null
  assistant: Assistant | null
  currentStatus: AssistantStatus | null
  form: ConfigForm
  onFormChange: (form: ConfigForm) => void
  onToggleActive: (newStatus: 'active' | 'paused') => void
  onSave: () => void
  onClose: () => void
  isSaving: boolean
}

function ConfigPanel({
  selectedId,
  assistant,
  currentStatus,
  form,
  onFormChange,
  onToggleActive,
  onSave,
  onClose,
  isSaving,
}: ConfigPanelProps) {
  const isNew = selectedId === 'new'
  const isEmpty = selectedId === null

  if (isEmpty) {
    return (
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderLeft: '0.5px solid #EAECEF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: '#FAFBFC',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#F3F4F6',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={18} color="#D1D5DB" />
          </div>
          <p
            style={{
              fontSize: 12,
              color: '#9CA3AF',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Selecteer een assistent
            <br />
            om te configureren
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        borderLeft: '0.5px solid #EAECEF',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAFBFC',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 14px 12px',
          borderBottom: '0.5px solid #EAECEF',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#0F172A',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isNew ? 'Nieuwe assistent' : (form.name || assistant?.name || '—')}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            {isNew ? 'Instellen en opslaan' : (assistant?.type ?? 'assistent')}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: '#9CA3AF',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Naam */}
          <Field label="Naam">
            <input
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="Assistent naam"
              style={INPUT_STYLE}
            />
          </Field>

          {/* Systeemprompt */}
          <Field label="Systeemprompt">
            <textarea
              value={form.systemPrompt}
              onChange={(e) => onFormChange({ ...form, systemPrompt: e.target.value })}
              placeholder="Je bent een behulpzame assistent die..."
              style={{
                ...INPUT_STYLE,
                height: 64,
                resize: 'none',
                padding: '7px 10px',
              }}
            />
          </Field>

          {/* Taalmodel */}
          <Field label="Taalmodel">
            <select
              value={form.model}
              onChange={(e) => onFormChange({ ...form, model: e.target.value })}
              style={{ ...INPUT_STYLE, background: '#fff', cursor: 'pointer' }}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Temperatuur */}
          <Field
            label="Temperatuur"
            rightLabel={form.temperature.toFixed(1)}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={form.temperature}
              onChange={(e) =>
                onFormChange({ ...form, temperature: parseFloat(e.target.value) })
              }
              style={{
                width: '100%',
                accentColor: TEAL,
                cursor: 'pointer',
                margin: '4px 0 0',
              }}
            />
          </Field>

          {/* Divider */}
          <div style={{ borderTop: '0.5px solid #EAECEF' }} />

          {/* Toggles */}
          <ToggleRow
            label="Geheugen"
            checked={form.memory}
            onChange={(v) => onFormChange({ ...form, memory: v })}
          />
          <ToggleRow
            label="Webzoeken"
            checked={form.webSearch}
            onChange={(v) => onFormChange({ ...form, webSearch: v })}
          />
          {!isNew && (
            <ToggleRow
              label="Actief"
              checked={currentStatus === 'active'}
              onChange={(v) => onToggleActive(v ? 'active' : 'paused')}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '0.5px solid #EAECEF',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          flexShrink: 0,
        }}
      >
        {!isNew && (
          <button
            style={{
              height: 32,
              borderRadius: 7,
              border: 'none',
              background: TEAL,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
          >
            <Zap size={12} strokeWidth={2.5} />
            Assistent starten
          </button>
        )}
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            height: 32,
            borderRadius: 7,
            border: `0.5px solid ${isNew ? 'transparent' : TEAL}`,
            background: isNew ? TEAL : 'transparent',
            color: isNew ? '#fff' : TEAL,
            fontSize: 12,
            fontWeight: 500,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: isSaving ? 0.6 : 1,
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          {isSaving ? (
            <>
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              Opslaan...
            </>
          ) : isNew ? (
            <>
              <Plus size={12} />
              Aanmaken
            </>
          ) : (
            'Opslaan'
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
  const router = useRouter()

  const [localAssistants, setLocalAssistants] = useState<Assistant[]>(initial)
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const { states, toggle, errorMessage, clearError } = useOptimisticToggle(
    localAssistants.map((a) => ({ id: a.id, status: a.status })),
    patchAssistantStatus
  )

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Open config panel for existing assistant
  const handleCardClick = useCallback(
    (id: string) => {
      const a = localAssistants.find((x) => x.id === id)
      if (!a) return
      setSelectedId(id)
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

  // Open config panel in new-mode, optionally pre-fill name
  const handleNew = useCallback((prefilledName = '') => {
    setSelectedId('new')
    setConfigForm({ ...EMPTY_FORM, name: prefilledName })
  }, [])

  // Toggle active/paused via optimistic hook
  const handleToggleActive = useCallback(
    async (newStatus: 'active' | 'paused') => {
      if (!selectedId || selectedId === 'new') return
      await toggle(selectedId, newStatus)
    },
    [selectedId, toggle]
  )

  // Save — either create or update
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
            tenantId: '00000000-0000-0000-0000-000000000001',
          }),
        })
        if (!res.ok) throw new Error()
        const created = (await res.json()) as Assistant
        setLocalAssistants((prev) => [created, ...prev])
        setSelectedId(created.id)
        setConfigForm((f) => ({ ...f, name: created.name, description: created.description }))
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

  // Filtered + sorted assistants
  const displayed = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const filtered = q
      ? localAssistants.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        )
      : localAssistants

    const ORDER: Record<AssistantStatus, number> = { error: 0, active: 1, paused: 2 }
    return [...filtered].sort(
      (a, b) =>
        (ORDER[states.get(a.id) ?? a.status] ?? 2) -
        (ORDER[states.get(b.id) ?? b.status] ?? 2)
    )
  }, [localAssistants, searchQuery, states])

  const activeCount = [...states.values()].filter((s) => s === 'active').length
  const errorAssistants = localAssistants.filter(
    (a) => (states.get(a.id) ?? a.status) === 'error'
  )

  const selectedAssistant =
    selectedId && selectedId !== 'new'
      ? (localAssistants.find((a) => a.id === selectedId) ?? null)
      : null

  const currentStatus =
    selectedId && selectedId !== 'new'
      ? (states.get(selectedId) ?? selectedAssistant?.status ?? null)
      : null

  const savedHours = (metrics.savedMinutes / 60).toFixed(1)

  const activeToast = toast?.msg ?? (errorMessage ?? null)
  const toastIsError = toast?.ok === false || (errorMessage !== null && toast === null)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 52,
          background: '#fff',
          borderBottom: '0.5px solid #EAECEF',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#0F172A',
            flexShrink: 0,
          }}
        >
          Mijn assistenten
        </span>

        {/* Search */}
        <div
          style={{
            flex: 1,
            maxWidth: 320,
            position: 'relative',
          }}
        >
          <Search
            size={13}
            color="#9CA3AF"
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Doorzoek assistenten..."
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 32,
              paddingRight: 12,
              border: '0.5px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
              color: '#374151',
              background: '#F9FAFB',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* + Nieuw */}
        <button
          onClick={() => handleNew()}
          style={{
            marginLeft: 'auto',
            height: 32,
            padding: '0 14px',
            borderRadius: 8,
            background: TEAL,
            color: '#fff',
            border: 'none',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          Nieuw
        </button>
      </div>

      {/* ── Main area (cards + config panel) ──────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px 24px',
            minWidth: 0,
          }}
        >

          {/* Stats bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              { label: 'bespaard vandaag', value: `${savedHours}u` },
              { label: 'actief',           value: `${activeCount} van ${metrics.totalCount}` },
              { label: 'taken vandaag',    value: String(metrics.runsToday) },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: '#fff',
                  border: '0.5px solid #EAECEF',
                  borderRadius: 10,
                  padding: '11px 14px',
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: '#9CA3AF',
                    margin: '0 0 5px',
                    textTransform: 'lowercase',
                  }}
                >
                  {m.label}
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: '#0F172A',
                    margin: 0,
                    lineHeight: 1,
                  }}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Quick-start banner */}
          <div
            style={{
              background: '#fff',
              border: '0.5px solid #EAECEF',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: '#ECFDF5',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Star size={15} color={TEAL} fill={TEAL} />
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#0F172A',
                  margin: 0,
                }}
              >
                Snel starten
              </p>
              <p
                style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}
              >
                Activeer je eerste assistent of gebruik een template
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 7,
                  border: '0.5px solid #E5E7EB',
                  background: '#fff',
                  fontSize: 12,
                  color: '#374151',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Advies
              </button>
              <button
                onClick={() => handleNew()}
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: TEAL,
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Nieuw
              </button>
            </div>
          </div>

          {/* Error alerts */}
          {errorAssistants.map((a) => (
            <div
              key={a.id}
              onClick={() => router.push(`/assistants/${a.id}?tab=connection`)}
              style={{
                background: '#FEF2F2',
                border: '0.5px solid #FECACA',
                borderRadius: 8,
                padding: '9px 14px',
                marginBottom: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#EF4444',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#B91C1C', flex: 1 }}>
                <strong>{a.name}</strong> staat uit —{' '}
                {a.lastError ?? 'verbindingsfout'}. Klik om te herstellen.
              </span>
              <ChevronRight size={13} color="#B91C1C" />
            </div>
          ))}

          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Assistenten
            </span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>
              {activeCount} actief
            </span>
          </div>

          {/* Cards grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: 8,
            }}
          >
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
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: '#9CA3AF',
                fontSize: 13,
              }}
            >
              {searchQuery
                ? `Geen resultaten voor "${searchQuery}"`
                : 'Nog geen assistenten'}
            </div>
          )}

          {/* Template chips */}
          <div style={{ marginTop: 24 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 10,
              }}
            >
              Templates
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TEMPLATE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleNew(chip.label)}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 20,
                    border: '0.5px solid #E5E7EB',
                    background: '#fff',
                    fontSize: 12,
                    color: '#374151',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: 'inherit',
                    transition: 'border-color 0.1s, color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = TEAL
                    e.currentTarget.style.color = TEAL
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.color = '#374151'
                  }}
                >
                  <span style={{ fontSize: 13 }}>{chip.emoji}</span>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: config panel (always visible) */}
        <ConfigPanel
          selectedId={selectedId}
          assistant={selectedAssistant}
          currentStatus={currentStatus}
          form={configForm}
          onFormChange={setConfigForm}
          onToggleActive={handleToggleActive}
          onSave={handleSave}
          onClose={() => setSelectedId(null)}
          isSaving={isSaving}
        />
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {activeToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toastIsError ? '#EF4444' : '#111827',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 12,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {activeToast}
          <button
            onClick={() => {
              setToast(null)
              clearError()
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

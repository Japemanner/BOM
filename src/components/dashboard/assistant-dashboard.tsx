'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Zap,
  Loader2,
  Send,
  Bot,
  Paperclip,
  Check,
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
  canUploadFiles?: boolean
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
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'indexed' | 'error'>('idle')
  const [pendingRunId, setPendingRunId] = useState<string | null>(null)
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scroll naar onder bij nieuwe berichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup poll timers bij unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      if (docPollTimerRef.current) clearTimeout(docPollTimerRef.current)
    }
  }, [])

  let msgCounter = 0
  const genMsgId = () => {
    msgCounter += 1
    return `${Date.now()}-${msgCounter}`
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')

    // Cancel lopende poll
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPendingRunId(null)

    const userMsg: ChatMessage = {
      id: genMsgId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: assistant.id,
          message: text,
          history,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Onbekende fout' }))
        setMessages((prev) => [
          ...prev,
          {
            id: genMsgId(),
            role: 'assistant',
            content: `⚠️ ${data.error ?? 'Fout bij verwerken'}`,
            timestamp: new Date().toISOString(),
          },
        ])
        setLoading(false)
        return
      }

      const data = await res.json()
      const runId = typeof data.runId === 'string' ? data.runId : undefined

      if (!runId) {
        // Fallback voor oud sync-patroon (backward-compat)
        setMessages((prev) => [
          ...prev,
          {
            id: genMsgId(),
            role: 'assistant',
            content: typeof data.text === 'string' ? data.text : 'Geen antwoord ontvangen.',
            timestamp: new Date().toISOString(),
          },
        ])
        setLoading(false)
        return
      }

      // Async pattern: start polling
      setPendingRunId(runId)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: genMsgId(),
          role: 'assistant',
          content: `⚠️ Netwerkfout: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date().toISOString(),
        },
      ])
      setLoading(false)
    }
  }

  // ── Poll logica ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingRunId) return

    const startTime = Date.now()
    const MAX_POLL_MS = 5 * 60 * 1000 // 5 min timeout

    const poll = async () => {
      try {
        const res = await fetch(`/api/chat/status/${pendingRunId}`)
        if (!res.ok) {
          // Retry bij 500s, stop bij 404
          if (res.status === 404) {
            setMessages((prev) => [
              ...prev,
              {
                id: genMsgId(),
                role: 'assistant',
                content: '⚠️ Run niet gevonden.',
                timestamp: new Date().toISOString(),
              },
            ])
            setLoading(false)
            setPendingRunId(null)
            return
          }
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()

        if (data.status === 'success') {
          const replyText = typeof data.text === 'string' ? data.text : 'Geen antwoord ontvangen.'
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: replyText,
              timestamp: new Date().toISOString(),
            },
          ])
          setLoading(false)
          setPendingRunId(null)
          return
        }

        if (data.status === 'failed') {
          const errText = typeof data.error === 'string' ? data.error : 'Onbekende fout'
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: `⚠️ ${errText}`,
              timestamp: new Date().toISOString(),
            },
          ])
          setLoading(false)
          setPendingRunId(null)
          return
        }

        // running of pending → poll door
        if (Date.now() - startTime > MAX_POLL_MS) {
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: '⚠️ Time-out: geen antwoord ontvangen binnen 5 minuten.',
              timestamp: new Date().toISOString(),
            },
          ])
          setLoading(false)
          setPendingRunId(null)
          return
        }

        pollTimerRef.current = setTimeout(poll, 2000)
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: genMsgId(),
            role: 'assistant',
            content: `⚠️ Poll-fout: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: new Date().toISOString(),
          },
        ])
        setLoading(false)
        setPendingRunId(null)
      }
    }

    pollTimerRef.current = setTimeout(poll, 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRunId])

  const handleUpload = async (file: File) => {
    if (!assistant.canUploadFiles) {
      setUploadStatus('error')
      setDocError('Upload niet toegestaan voor deze assistent')
      setTimeout(() => { setUploadStatus('idle'); setDocError(null) }, 3000)
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadStatus('error')
      setDocError('Bestand is te groot (max 50 MB)')
      setTimeout(() => { setUploadStatus('idle'); setDocError(null) }, 3000)
      return
    }

    setUploadStatus('uploading')
    setDocError(null)

    try {
      // 1. Vraag presigned URL op
      const res = await fetch('/api/rag/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: assistant.id,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      })

      if (!res.ok) throw new Error('Upload URL ophalen mislukt')

      const { uploadUrl, documentId } = await res.json()
      if (!documentId || !uploadUrl) throw new Error('Ongeldige response van upload-url')

      // 2. Upload direct naar S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) throw new Error(`Upload naar S3 mislukt: HTTP ${uploadRes.status}`)

      // 3. Bevestig upload → triggereer N8N
      const confirmRes = await fetch('/api/rag/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!confirmRes.ok) {
        const errData = await confirmRes.json().catch(() => null)
        throw new Error(errData?.error ?? `Confirmatie mislukt: HTTP ${confirmRes.status}`)
      }

      // 4. Start document polling
      setUploadStatus('processing')
      setPendingDocumentId(documentId)
      setMessages((prev) => [
        ...prev,
        {
          id: genMsgId(),
          role: 'assistant',
          content: `📎 Bestand "${file.name}" geüpload. Documenten worden verwerkt voor RAG...`,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setUploadStatus('error')
      setDocError(errMsg)
      setMessages((prev) => [
        ...prev,
        {
          id: genMsgId(),
          role: 'assistant',
          content: `⚠️ Upload mislukt: ${errMsg}`,
          timestamp: new Date().toISOString(),
        },
      ])
      setTimeout(() => { setUploadStatus('idle'); setDocError(null) }, 5000)
    }
  }

  // ── Document status poll logica ───────────────────────────────────────────
  useEffect(() => {
    if (!pendingDocumentId) return

    const startTime = Date.now()
    const MAX_DOC_POLL_MS = 5 * 60 * 1000 // 5 min timeout

    const pollDoc = async () => {
      try {
        const res = await fetch(`/api/rag/status/${pendingDocumentId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setMessages((prev) => [
              ...prev,
              {
                id: genMsgId(),
                role: 'assistant',
                content: '⚠️ Document niet gevonden.',
                timestamp: new Date().toISOString(),
              },
            ])
            setUploadStatus('idle')
            setPendingDocumentId(null)
            return
          }
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()

        if (data.status === 'indexed') {
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: `📎 Document "${data.filename}" is klaar en kan nu worden gebruikt in gesprekken.`,
              timestamp: new Date().toISOString(),
            },
          ])
          setUploadStatus('indexed')
          setTimeout(() => setUploadStatus('idle'), 4000)
          setPendingDocumentId(null)
          return
        }

        if (data.status === 'failed') {
          const errText = typeof data.errorMessage === 'string' ? data.errorMessage : 'Verwerking mislukt'
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: `⚠️ Document verwerking mislukt: ${errText}`,
              timestamp: new Date().toISOString(),
            },
          ])
          setUploadStatus('error')
          setDocError(errText)
          setTimeout(() => { setUploadStatus('idle'); setDocError(null) }, 5000)
          setPendingDocumentId(null)
          return
        }

        // uploaded, processing → poll door
        if (Date.now() - startTime > MAX_DOC_POLL_MS) {
          setMessages((prev) => [
            ...prev,
            {
              id: genMsgId(),
              role: 'assistant',
              content: '⚠️ Time-out: document verwerking duurde langer dan 5 minuten.',
              timestamp: new Date().toISOString(),
            },
          ])
          setUploadStatus('error')
          setPendingDocumentId(null)
          return
        }

        docPollTimerRef.current = setTimeout(pollDoc, 2500)
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: genMsgId(),
            role: 'assistant',
            content: `⚠️ Poll-fout: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: new Date().toISOString(),
          },
        ])
        setUploadStatus('error')
        setPendingDocumentId(null)
      }
    }

    docPollTimerRef.current = setTimeout(pollDoc, 2000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocumentId])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = '' // reset voor herhaalde uploads
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
      <div data-testid="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          <div data-testid="chat-typing-indicator" style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '6px 10px' }}>
            {<span key={1} style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1', display: 'inline-block', animation: 'typing 1.2s infinite 0s' }} />}
            {<span key={2} style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1', display: 'inline-block', animation: 'typing 1.2s infinite 0.2s' }} />}
            {<span key={3} style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1', display: 'inline-block', animation: 'typing 1.2s infinite 0.4s' }} />}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '0.5px solid #EAECEF', flexShrink: 0 }}>
        {uploadStatus === 'error' && docError && (
          <p style={{ fontSize: 11, color: '#EF4444', margin: '0 0 6px' }}>{docError}</p>
        )}
        {uploadStatus === 'processing' && (
          <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 6px' }}>Documenten worden verwerkt voor RAG...</p>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {assistant.canUploadFiles && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={onFileChange}
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                style={{
                  width: 32, height: 32, borderRadius: 7,
                  border: 'none', background: '#F1F5F9',
                  color: (uploadStatus === 'uploading' || uploadStatus === 'processing') ? '#CBD5E1'
                    : uploadStatus === 'indexed' ? '#22C55E'
                    : uploadStatus === 'error' ? '#EF4444'
                    : '#64748B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (uploadStatus === 'uploading' || uploadStatus === 'processing') ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : uploadStatus === 'indexed' ? (
                  <Check size={14} />
                ) : (
                  <Paperclip size={14} />
                )}
              </button>
            </>
          )}
          <textarea
            data-testid="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Typ een bericht..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1, minHeight: 34, maxHeight: 120, padding: '8px 10px',
              borderRadius: 7, border: '0.5px solid #E2E8F0',
              fontSize: 12, outline: 'none', fontFamily: 'inherit',
              background: loading ? '#F9FAFB' : '#fff', color: '#0F172A',
              resize: 'none', lineHeight: 1.4,
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            data-testid="chat-send-button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              width: 32, height: 32, borderRadius: 7,
              border: 'none', background: TEAL, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes typing {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
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

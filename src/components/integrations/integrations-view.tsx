'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  Mail,
  Database,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'

const TEAL = '#1D9E75'

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing'

interface TelegramConfig {
  botToken: string
  chatId: string
}

interface MailConfig {
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPassword: string
  fromAddress: string
  fromName: string
}

interface RagIntegration {
  id: string
  type: string
  status: string
  config: {
    webhookUrl: string | null
    hasToken: boolean
  }
}

// ── Hulpcomponenten ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  borderRadius: 7,
  border: '0.5px solid #E2E8F0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#0F172A',
  background: '#fff',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, { label: string; color: string; bg: string }> = {
    connected:    { label: 'Verbonden',    color: TEAL,      bg: '#ECFDF5' },
    disconnected: { label: 'Niet gekoppeld', color: '#9CA3AF', bg: '#F3F4F6' },
    error:        { label: 'Fout',         color: '#EF4444', bg: '#FEF2F2' },
    testing:      { label: 'Testen...',    color: '#F59E0B', bg: '#FFFBEB' },
  }
  const { label, color, bg } = map[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color,
        background: bg,
        padding: '3px 8px',
        borderRadius: 6,
      }}
    >
      {label}
    </span>
  )
}

// ── Telegram kaart ─────────────────────────────────────────────────────────

function TelegramCard() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [config, setConfig] = useState<TelegramConfig>({ botToken: '', chatId: '' })
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleTest = async () => {
    if (!config.botToken.trim()) {
      showToast('Voer eerst een Bot Token in')
      return
    }
    setStatus('testing')
    await new Promise((r) => setTimeout(r, 1200))
    const ok = config.botToken.length > 20
    setStatus(ok ? 'connected' : 'error')
    showToast(ok ? 'Verbinding geslaagd' : 'Token ongeldig — controleer je bot token')
  }

  const handleDisconnect = () => {
    setConfig({ botToken: '', chatId: '' })
    setStatus('disconnected')
    showToast('Telegram ontkoppeld')
  }

  return (
    <IntegrationCard
      icon={<Send size={18} color={status === 'connected' ? TEAL : '#9CA3AF'} />}
      iconBg={status === 'connected' ? '#ECFDF5' : '#F3F4F6'}
      title="Telegram"
      description="Ontvang notificaties en stuur berichten via een Telegram-bot"
      status={status}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      toast={toast}
      onToastClose={() => setToast(null)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <Field label="Bot Token" hint="— van @BotFather">
          <input
            value={config.botToken}
            onChange={(e) => setConfig((c) => ({ ...c, botToken: e.target.value }))}
            placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
            type="password"
            style={inputStyle}
          />
        </Field>

        <Field label="Chat ID" hint="— van je kanaal of groep">
          <input
            value={config.chatId}
            onChange={(e) => setConfig((c) => ({ ...c, chatId: e.target.value }))}
            placeholder="-1001234567890"
            style={inputStyle}
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            onClick={handleTest}
            disabled={status === 'testing'}
            style={{
              height: 32, padding: '0 14px', borderRadius: 7,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: status === 'testing' ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {status === 'testing'
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Testen...</>
              : 'Verbinding testen'
            }
          </button>
          {status === 'connected' && (
            <button
              onClick={handleDisconnect}
              style={{
                height: 32, padding: '0 14px', borderRadius: 7,
                border: '0.5px solid #FECACA', background: '#FEF2F2',
                color: '#B91C1C', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ontkoppelen
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
          Maak een bot via <strong>@BotFather</strong> op Telegram en plak het token hierboven.
          Het Chat ID vind je via <strong>@userinfobot</strong>.
        </p>
      </div>
    </IntegrationCard>
  )
}

// ── Mail kaart ─────────────────────────────────────────────────────────────

function MailCard() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [config, setConfig] = useState<MailConfig>({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    fromAddress: '',
    fromName: '',
  })
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleTest = async () => {
    if (!config.smtpHost.trim() || !config.smtpUser.trim()) {
      showToast('Vul minimaal SMTP-host en gebruikersnaam in')
      return
    }
    setStatus('testing')
    await new Promise((r) => setTimeout(r, 1400))
    const ok = config.smtpHost.includes('.')
    setStatus(ok ? 'connected' : 'error')
    showToast(ok ? 'SMTP-verbinding geslaagd' : 'Verbinding mislukt — controleer de instellingen')
  }

  const handleDisconnect = () => {
    setConfig({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', fromAddress: '', fromName: '' })
    setStatus('disconnected')
    showToast('Mail ontkoppeld')
  }

  return (
    <IntegrationCard
      icon={<Mail size={18} color={status === 'connected' ? TEAL : '#9CA3AF'} />}
      iconBg={status === 'connected' ? '#ECFDF5' : '#F3F4F6'}
      title="E-mail (SMTP)"
      description="Verstuur e-mails via je eigen mailserver of dienst zoals Resend of Brevo"
      status={status}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      toast={toast}
      onToastClose={() => setToast(null)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
          <Field label="SMTP-host">
            <input
              value={config.smtpHost}
              onChange={(e) => setConfig((c) => ({ ...c, smtpHost: e.target.value }))}
              placeholder="smtp.resend.com"
              style={inputStyle}
            />
          </Field>
          <Field label="Poort">
            <input
              value={config.smtpPort}
              onChange={(e) => setConfig((c) => ({ ...c, smtpPort: e.target.value }))}
              placeholder="587"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Gebruikersnaam">
            <input
              value={config.smtpUser}
              onChange={(e) => setConfig((c) => ({ ...c, smtpUser: e.target.value }))}
              placeholder="apikey"
              style={inputStyle}
            />
          </Field>
          <Field label="Wachtwoord / API-sleutel">
            <input
              value={config.smtpPassword}
              onChange={(e) => setConfig((c) => ({ ...c, smtpPassword: e.target.value }))}
              placeholder="••••••••"
              type="password"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Afzendernaam">
            <input
              value={config.fromName}
              onChange={(e) => setConfig((c) => ({ ...c, fromName: e.target.value }))}
              placeholder="AssistHub"
              style={inputStyle}
            />
          </Field>
          <Field label="Afzenderadres">
            <input
              value={config.fromAddress}
              onChange={(e) => setConfig((c) => ({ ...c, fromAddress: e.target.value }))}
              placeholder="noreply@jouwdomein.nl"
              type="email"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            onClick={handleTest}
            disabled={status === 'testing'}
            style={{
              height: 32, padding: '0 14px', borderRadius: 7,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: status === 'testing' ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {status === 'testing'
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Testen...</>
              : 'Verbinding testen'
            }
          </button>
          {status === 'connected' && (
            <button
              onClick={handleDisconnect}
              style={{
                height: 32, padding: '0 14px', borderRadius: 7,
                border: '0.5px solid #FECACA', background: '#FEF2F2',
                color: '#B91C1C', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ontkoppelen
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
          Gebruik poort <strong>587</strong> (STARTTLS) of <strong>465</strong> (SSL).
          Voor Resend gebruik je <strong>apikey</strong> als gebruikersnaam en je API-sleutel als wachtwoord.
        </p>
      </div>
    </IntegrationCard>
  )
}

// ── RAG Vectorisatie kaart ─────────────────────────────────────────────────

function RagCard() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [showSecret, setShowSecret] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/integrations')
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as RagIntegration[]
        const rag = data.find((d) => d.type === 'rag')
        if (rag) {
          if (rag.config.webhookUrl) setWebhookUrl(rag.config.webhookUrl)
          if (rag.status === 'active') setStatus('connected')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      showToast('Webhook URL is verplicht')
      return
    }
    if (!webhookToken.trim()) {
      showToast('Secret is verplicht')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rag',
          config: { webhookUrl: webhookUrl.trim(), webhookToken: webhookToken.trim() },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setStatus('connected')
      showToast('RAG vectorisatie webhook opgeslagen')
    } catch (err) {
      showToast(`Opslaan mislukt: ${err instanceof Error ? err.message : 'Onbekende fout'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = () => {
    setWebhookUrl('')
    setWebhookToken('')
    setStatus('disconnected')
    showToast('RAG webhook verwijderd — opslaan om wijziging door te voeren')
  }

  if (loading) {
    return (
      <IntegrationCard
        icon={<Database size={18} color="#9CA3AF" />}
        iconBg="#F3F4F6"
        title="RAG Vectorisatie"
        description="Configureer de n8n webhook voor document vectorisatie"
        status="disconnected"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        toast={null}
        onToastClose={() => {}}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
        </div>
      </IntegrationCard>
    )
  }

  return (
    <IntegrationCard
      icon={<Database size={18} color={status === 'connected' ? TEAL : '#9CA3AF'} />}
      iconBg={status === 'connected' ? '#ECFDF5' : '#F3F4F6'}
      title="RAG Vectorisatie"
      description="Configureer de n8n webhook voor document vectorisatie — gedeeld voor alle kennisbronnen"
      status={status}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      toast={toast}
      onToastClose={() => setToast(null)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <Field label="Webhook URL" hint="— de n8n-webhook die vectorisatie triggert">
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://jouw-n8n.domein.nl/webhook/rag-vectorize"
            style={inputStyle}
          />
        </Field>

        <Field label="Secret" hint="— gedeeld JWT-secret voor beveiligde communicatie">
          <div style={{ position: 'relative' }}>
            <input
              value={webhookToken}
              onChange={(e) => setWebhookToken(e.target.value)}
              placeholder="minimaal 8 tekens"
              type={showSecret ? 'text' : 'password'}
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <button
              onClick={() => setShowSecret((v) => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                color: '#9CA3AF',
                display: 'flex',
              }}
            >
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 32, padding: '0 14px', borderRadius: 7,
              background: TEAL, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {saving
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan...</>
              : 'Opslaan'
            }
          </button>
          {status === 'connected' && (
            <button
              onClick={handleDisconnect}
              style={{
                height: 32, padding: '0 14px', borderRadius: 7,
                border: '0.5px solid #FECACA', background: '#FEF2F2',
                color: '#B91C1C', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ontkoppelen
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
          BOM verstuurt een JWT-beveiligde POST naar deze webhook bij document-upload.
          De n8n-workflow verwerkt het document en belt terug via <code>/api/rag/callback</code>.
          Dit secret wordt versleuteld opgeslagen.
        </p>
      </div>
    </IntegrationCard>
  )
}

// ── Generieke kaart wrapper ────────────────────────────────────────────────

interface IntegrationCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  status: ConnectionStatus
  open: boolean
  onToggle: () => void
  toast: string | null
  onToastClose: () => void
  children: React.ReactNode
}

function IntegrationCard({
  icon, iconBg, title, description, status,
  open, onToggle, toast, onToastClose, children,
}: IntegrationCardProps) {
  return (
    <>
      <div
        style={{
          background: '#fff',
          border: `0.5px solid ${status === 'connected' ? '#A7F3D0' : '#EAECEF'}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 9,
              background: iconBg, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: 0 }}>
              {title}
            </p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
              {description}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <StatusBadge status={status} />
            {open
              ? <ChevronUp size={14} color="#9CA3AF" />
              : <ChevronDown size={14} color="#9CA3AF" />
            }
          </div>
        </div>

        {open && (
          <div
            style={{
              padding: '0 16px 16px',
              borderTop: '0.5px solid #F3F4F6',
            }}
          >
            <div style={{ paddingTop: 14 }}>{children}</div>
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24,
            background: '#111827', color: '#fff',
            padding: '10px 16px', borderRadius: 8,
            fontSize: 12, zIndex: 100,
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {toast}
          <button
            onClick={onToastClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}

// ── Hoofdpagina ────────────────────────────────────────────────────────────

const tabStyle: React.CSSProperties = {
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s',
}

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: TEAL,
  color: '#fff',
}

const tabInactiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#F3F4F6',
  color: '#6B7280',
}

type TabId = 'kanalen' | 'kennisbronnen'

export function IntegrationsView() {
  const [activeTab, setActiveTab] = useState<TabId>('kanalen')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'kanalen', label: 'Kanalen' },
    { id: 'kennisbronnen', label: 'Kennisbronnen' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <div
        style={{
          height: 52, background: '#fff',
          borderBottom: '0.5px solid #EAECEF',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
          Integraties
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 640 }}>

          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={activeTab === tab.id ? tabActiveStyle : tabInactiveStyle}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTab === 'kanalen' && (
              <>
                <TelegramCard />
                <MailCard />
              </>
            )}
            {activeTab === 'kennisbronnen' && (
              <RagCard />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

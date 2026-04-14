'use client'

import { useState } from 'react'
import {
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
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
    // Simuleer API-call — vervang door echte Telegram getMe-check
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

        {/* SMTP host + port */}
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

        {/* Gebruikersnaam + wachtwoord */}
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

        {/* Afzender */}
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
        {/* Header */}
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

        {/* Uitklapbaar formulier */}
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

      {/* Toast per kaart */}
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

export function IntegrationsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 640 }}>

          {/* Sectieheader */}
          <p
            style={{
              fontSize: 10, fontWeight: 500, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              margin: '0 0 12px',
            }}
          >
            Kanalen
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TelegramCard />
            <MailCard />
          </div>

        </div>
      </div>
    </div>
  )
}

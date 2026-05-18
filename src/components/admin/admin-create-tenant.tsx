'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TenantPlan } from '@/types'

const TEAL = '#1D9E75'

interface CreateTenantModalProps {
  onClose: () => void
  onCreated: () => void
  showToast: (msg: string, ok?: boolean) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateTenantModal({ onClose, onCreated, showToast }: CreateTenantModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState<string>(TenantPlan.FREE)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState<{ tenantId: string; userId: string; tenantSlug: string } | null>(null)

  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(slugify(value))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!name.trim() || name.trim().length < 2) errs.name = 'Naam minimaal 2 tekens'
    if (!slug.trim() || slug.trim().length < 2) errs.slug = 'Slug minimaal 2 tekens'
    else if (!/^[a-z0-9-]+$/.test(slug)) errs.slug = 'Alleen kleine letters, cijfers en koppeltekens'
    if (!userName.trim() || userName.trim().length < 2) errs.userName = 'Naam minimaal 2 tekens'
    if (!userEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) errs.userEmail = 'Ongeldig e-mailadres'
    if (!userPassword.trim()) errs.userPassword = 'Wachtwoord is verplicht'
    else if (userPassword.length < 8) errs.userPassword = 'Wachtwoord minimaal 8 tekens'

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          plan,
          userName: userName.trim(),
          userEmail: userEmail.trim(),
          userPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))
      const errMsg = (data as { error?: string }).error

      if (!res.ok) {
        if (errMsg) {
          setError(errMsg)
        }
        showToast(errMsg ?? 'Tenant aanmaken mislukt', false)
        return
      }

      setSuccess({
        tenantId: (data as { tenantId: string }).tenantId,
        userId: (data as { userId: string }).userId,
        tenantSlug: (data as { tenantSlug: string }).tenantSlug,
      })
      showToast('Tenant aangemaakt', true)
      onCreated()
    } catch {
      showToast('Netwerkfout — probeer opnieuw', false)
      setError('Netwerkfout — probeer opnieuw')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 12, width: 420, maxWidth: '90vw',
            padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>
            Tenant aangemaakt
          </h3>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 13, color: '#065F46', margin: 0, fontWeight: 500 }}>
                {name} is succesvol aangemaakt.
              </p>
            </div>

            <div>
              <label style={smallLabel}>Tenant ID</label>
              <p style={valueStyle}>{success.tenantId}</p>
            </div>

            <div>
              <label style={smallLabel}>Slug</label>
              <p style={valueStyle}>{success.tenantSlug}</p>
            </div>

            <div>
              <label style={smallLabel}>Gebruiker</label>
              <p style={valueStyle}>{userName} — {userEmail}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              onClick={onClose}
              style={{
                height: 36, padding: '0 16px', borderRadius: 7,
                border: 'none', background: TEAL,
                fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
    border: `0.5px solid ${fieldErrors[field] ? '#FCA5A5' : '#E2E8F0'}`,
    fontSize: 13, outline: 'none',
    fontFamily: 'inherit', color: '#0F172A', boxSizing: 'border-box',
    background: fieldErrors[field] ? '#FEF2F2' : '#fff',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: 460, maxWidth: '90vw',
          padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>
          Tenant aanmaken
        </h3>
        <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
          Maak een nieuwe organisatie aan met een beheerder.
        </p>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Organisatie
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={smallLabel}>Naam</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Bijv. Hans BV"
                  style={inputStyle('name')}
                />
                {fieldErrors.name && <p style={errorTextStyle}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label style={smallLabel}>Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="bijv-hans-bv"
                  style={inputStyle('slug')}
                />
                {fieldErrors.slug && <p style={errorTextStyle}>{fieldErrors.slug}</p>}
                {!fieldErrors.slug && (
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
                    Automatisch gegenereerd uit naam — handmatig aanpasbaar
                  </p>
                )}
              </div>

              <div>
                <label style={smallLabel}>Abonnement</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  style={{
                    width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
                    border: '0.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                    fontFamily: 'inherit', color: '#0F172A', background: '#fff',
                    boxSizing: 'border-box', cursor: 'pointer',
                  }}
                >
                  <option value={TenantPlan.FREE}>Free</option>
                  <option value={TenantPlan.PRO}>Pro</option>
                  <option value={TenantPlan.ENTERPRISE}>Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #E2E8F0', paddingTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Beheerder
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={smallLabel}>Naam</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Volledige naam"
                  style={inputStyle('userName')}
                />
                {fieldErrors.userName && <p style={errorTextStyle}>{fieldErrors.userName}</p>}
              </div>

              <div>
                <label style={smallLabel}>E-mailadres</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="naam@bedrijf.nl"
                  style={inputStyle('userEmail')}
                />
                {fieldErrors.userEmail && <p style={errorTextStyle}>{fieldErrors.userEmail}</p>}
              </div>

              <div>
                <label style={smallLabel}>Wachtwoord</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Minimaal 8 tekens"
                  style={inputStyle('userPassword')}
                />
                {fieldErrors.userPassword && <p style={errorTextStyle}>{fieldErrors.userPassword}</p>}
              </div>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{error}</p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px', borderRadius: 7,
              border: '0.5px solid #E2E8F0', background: '#fff',
              fontSize: 13, color: '#374151', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              height: 36, padding: '0 16px', borderRadius: 7,
              border: 'none', background: TEAL,
              fontSize: 13, fontWeight: 500, color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Tenant aanmaken
          </button>
        </div>
      </div>
    </div>
  )
}

const smallLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4,
}

const errorTextStyle: React.CSSProperties = {
  fontSize: 11, color: '#DC2626', margin: '2px 0 0',
}

const valueStyle: React.CSSProperties = {
  fontSize: 13, color: '#0F172A', margin: 0, wordBreak: 'break-all',
  fontFamily: '"SF Mono", "Fira Code", monospace',
}

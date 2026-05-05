'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, X, Loader2, Plus } from 'lucide-react'
import { UserRole } from '@/types'

interface Member {
  userId: string
  name: string
  email: string
  image: string | null
  role: string
  joinedAt: string
  tenantId: string
  tenantName: string
}

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
}

interface AdminUsersProps {
  tenants: Tenant[]
  isSuperAdmin: boolean
  currentUserId: string
}

const roleLabel: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Beheerder',
  member: 'Medewerker',
}

const roleBadgeStyle: Record<string, React.CSSProperties> = {
  super_admin: {
    background: '#FEF3C7', color: '#B45309', fontSize: 11, fontWeight: 500,
    padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
  },
  admin: {
    background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 500,
    padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
  },
  member: {
    background: '#EFF6FF', color: '#1E40AF', fontSize: 11, fontWeight: 500,
    padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
  },
}

const roleHelpText = 'Beheerder: volledige toegang tot assistenten, integraties, webhooks en gebruikersbeheer. Medewerker: kan assistenten, integraties en kennisbronnen bekijken en bewerken, maar geen webhooks of gebruikers beheren.'

function RoleHelp() {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)

  const handleEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 })
    }
    setShow(true)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 15, height: 15, borderRadius: '50%',
          border: '0.5px solid #94A3B8', color: '#94A3B8',
          fontSize: 9, fontWeight: 600, cursor: 'help',
        }}
      >?</span>
      {show && (
        <span style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translateX(-50%)',
          background: '#fff',
          color: '#0F172A',
          fontSize: 12,
          padding: '10px 14px',
          borderRadius: 8,
          maxWidth: 280,
          lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          border: '0.5px solid #E2E8F0',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {roleHelpText}
        </span>
      )}
    </span>
  )
}

function CreateUserModal({
  onClose,
  onCreated,
  showToast,
}: {
  onClose: () => void
  onCreated: () => void
  showToast: (msg: string, ok?: boolean) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>(UserRole.MEMBER)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Alle velden zijn verplicht')
      return
    }
    if (password.length < 8) {
      setError('Wachtwoord minimaal 8 tekens')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errMsg = (data as { error?: string }).error ?? 'Gebruiker toevoegen mislukt'
        showToast(errMsg, false)
        setError(errMsg)
        return
      }
      showToast('Gebruiker toegevoegd', true)
      onCreated()
      onClose()
    } catch {
      showToast('Netwerkfout — probeer opnieuw', false)
      setError('Netwerkfout — probeer opnieuw')
    } finally {
      setSubmitting(false)
    }
  }

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
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>Gebruiker toevoegen</h3>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Volledige naam"
              style={{
                width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
                border: '0.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', color: '#0F172A', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>E-mailadres</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@bedrijf.nl"
              style={{
                width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
                border: '0.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', color: '#0F172A', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimaal 8 tekens"
              style={{
                width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
                border: '0.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', color: '#0F172A', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Rol</span>
              <RoleHelp />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: '100%', height: 34, padding: '0 10px', borderRadius: 7,
                border: '0.5px solid #E2E8F0', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', color: '#0F172A', background: '#fff',
                boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              <option value={UserRole.MEMBER}>Medewerker</option>
              <option value={UserRole.ADMIN}>Beheerder</option>
            </select>
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
              border: 'none', background: '#1D9E75',
              fontSize: 13, fontWeight: 500, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: 380, maxWidth: '90vw',
          padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#64748B', margin: '8px 0 20px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
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
            onClick={onConfirm}
            style={{
              height: 36, padding: '0 16px', borderRadius: 7,
              border: 'none', background: '#EF4444',
              fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, ok, onClose }: { message: string; ok: boolean; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 60,
        background: ok ? '#065F46' : '#991B1B', color: '#fff',
        padding: '10px 18px', borderRadius: 8, fontSize: 13,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function AdminUsers({ tenants, isSuperAdmin, currentUserId }: AdminUsersProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; tenantId: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
  }, [])

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (isSuperAdmin && selectedTenant) {
        params.set('tenantId', selectedTenant)
      }
      const url = `/api/members${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast((data as { error?: string }).error ?? 'Lijst ophalen mislukt', false)
        return
      }
      const data: Member[] = await res.json()
      setMembers(data)
    } catch {
      showToast('Lijst ophalen mislukt', false)
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, selectedTenant, showToast])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const handleRoleChange = async (userId: string, tenantId: string, newRole: string) => {
    setChangingRole(`${userId}:${tenantId}`)
    try {
      const params = new URLSearchParams()
      if (isSuperAdmin) params.set('tenantId', tenantId)
      const url = `/api/members/${userId}${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast((data as { error?: string }).error ?? 'Rol wijzigen mislukt', false)
        return
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId && m.tenantId === tenantId
            ? { ...m, role: newRole }
            : m
        )
      )
      showToast(`Rol gewijzigd naar ${roleLabel[newRole] ?? newRole}`)
    } catch {
      showToast('Rol wijzigen mislukt', false)
    } finally {
      setChangingRole(null)
    }
  }

  const handleDelete = async (userId: string, tenantId: string) => {
    setDeletingId(`${userId}:${tenantId}`)
    try {
      const params = new URLSearchParams()
      if (isSuperAdmin) params.set('tenantId', tenantId)
      const url = `/api/members/${userId}${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast((data as { error?: string }).error ?? 'Verwijderen mislukt', false)
        return
      }
      setMembers((prev) =>
        prev.filter((m) => !(m.userId === userId && m.tenantId === tenantId))
      )
      showToast('Gebruiker verwijderd')
    } catch {
      showToast('Verwijderen mislukt', false)
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  const isCurrentUser = (m: Member) => m.userId === currentUserId

  return (
    <div>
      {toast && (
        <Toast
          message={toast.msg}
          ok={toast.ok}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Gebruiker verwijderen"
          message={`Weet je zeker dat je ${confirmDelete.name} wilt verwijderen uit deze organisatie? Deze actie kan niet ongedaan worden gemaakt.`}
          onConfirm={() => handleDelete(confirmDelete.userId, confirmDelete.tenantId)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={loadMembers}
          showToast={showToast}
        />
      )}

      {/* Tenant filter voor super admins */}
      {isSuperAdmin && tenants.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Organisatie:</label>
          <select
            value={selectedTenant ?? ''}
            onChange={(e) => setSelectedTenant(e.target.value || null)}
            style={{
              height: 34, padding: '0 10px', borderRadius: 7,
              border: '0.5px solid #E2E8F0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit', color: '#0F172A',
              background: '#fff', minWidth: 200,
            }}
          >
            <option value="">Alle organisaties</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
          {members.length} gebruiker{members.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 34, padding: '0 14px', borderRadius: 7,
            border: 'none', background: '#1D9E75',
            fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={14} />
          Gebruiker toevoegen
        </button>
      </div>

      {/* Lijst */}
      <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#94A3B8', display: 'inline-block' }} />
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Geen gebruikers gevonden</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #EAECEF', background: '#F8FAFC' }}>
                <th style={headerStyle}>Naam</th>
                <th style={headerStyle}>Email</th>
                {isSuperAdmin && !selectedTenant && (
                  <th style={headerStyle}>Organisatie</th>
                )}
                <th style={headerStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Rol
                    <RoleHelp />
                  </span>
                </th>
                <th style={headerStyle}>Sinds</th>
                <th style={{ ...headerStyle, width: 140 }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const memberKey = `${m.userId}:${m.tenantId}`
                const loadingKey = changingRole === memberKey || deletingId === memberKey
                const self = isCurrentUser(m)
                const currentRole = m.role
                const isRoleChanging = changingRole === memberKey
                const isDeleting = deletingId === memberKey

                return (
                  <tr
                    key={memberKey}
                    style={{
                      borderBottom: '0.5px solid #F1F5F9',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#E2E8F0', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 500, color: '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {m.name
                            .split(' ')
                            .map((n) => n[0] ?? '')
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>
                          {m.name}
                        </span>
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>{m.email}</span>
                    </td>
                    {isSuperAdmin && !selectedTenant && (
                      <td style={cellStyle}>
                        <span style={{ fontSize: 13, color: '#64748B' }}>{m.tenantName}</span>
                      </td>
                    )}
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={roleBadgeStyle[currentRole] ?? roleBadgeStyle.member}>
                          {roleLabel[currentRole] ?? currentRole}
                        </span>
                        {!self && !isRoleChanging && currentRole !== UserRole.SUPER_ADMIN && (
                          <select
                            value={currentRole}
                            onChange={(e) => handleRoleChange(m.userId, m.tenantId, e.target.value)}
                            style={{
                              height: 26, padding: '0 6px', borderRadius: 5,
                              border: '0.5px solid #E2E8F0', fontSize: 11,
                              outline: 'none', fontFamily: 'inherit', color: '#475569',
                              background: '#fff', cursor: 'pointer',
                            }}
                          >
                            <option value={UserRole.ADMIN}>Beheerder</option>
                            <option value={UserRole.MEMBER}>Medewerker</option>
                          </select>
                        )}
                        {!self && isRoleChanging && (
                          <Loader2
                            size={14}
                            style={{ animation: 'spin 1s linear infinite', color: '#94A3B8' }}
                          />
                        )}
                        {self && (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>(jij)</span>
                        )}
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontSize: 13, color: '#64748B' }}>
                        {new Date(m.joinedAt).toLocaleDateString('nl-NL')}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          disabled={self || loadingKey}
                          onClick={() =>
                            setConfirmDelete({ userId: m.userId, tenantId: m.tenantId, name: m.name })
                          }
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            height: 30, padding: '0 10px', borderRadius: 6,
                            border: '0.5px solid #FECACA', background: '#FEF2F2',
                            fontSize: 12, color: '#DC2626', cursor: self || loadingKey ? 'not-allowed' : 'pointer',
                            opacity: self || loadingKey ? 0.4 : 1,
                            fontFamily: 'inherit', whiteSpace: 'nowrap',
                          }}
                        >
                          {isDeleting ? (
                            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Verwijder
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const headerStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 12,
  fontWeight: 500, color: '#64748B', fontFamily: 'inherit',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle',
}

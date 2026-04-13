'use client'

import { Mail } from 'lucide-react'

interface TopbarProps {
  title?: string
  userName?: string
  openReviewCount?: number
}

export function Topbar({
  title = 'Dashboard',
  userName = 'Gebruiker',
  openReviewCount = 0,
}: TopbarProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      style={{
        height: 48,
        background: '#fff',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
      }}
    >
      {/* Links: paginatitel */}
      <h1 style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: 0 }}>
        {title}
      </h1>

      {/* Rechts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live indicator */}
        <div
          aria-live="polite"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22C55E',
              display: 'inline-block',
              animation: 'livePulse 2s infinite',
            }}
          />
          <span style={{ fontSize: 11, color: '#64748B' }}>Live</span>
        </div>

        {/* Notificatie knop */}
        <button
          onClick={() => { window.location.href = '/inbox' }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
          aria-label={`Review-inbox, ${openReviewCount} open items`}
        >
          <Mail size={14} color="#64748B" />
          {openReviewCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#EF4444',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {openReviewCount > 9 ? '9+' : openReviewCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#3B82F6',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={userName}
        >
          {initials}
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </header>
  )
}

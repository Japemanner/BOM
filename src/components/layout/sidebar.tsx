'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  BookOpen,
  MessageSquare,
  BarChart2,
  Settings,
  Plug,
  Zap,
} from 'lucide-react'

const TEAL = '#1D9E75'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

const WORKSPACE_ITEMS: NavItem[] = [
  { href: '/',              icon: LayoutGrid,    label: 'Mijn assistenten' },
  { href: '/templates',    icon: BookOpen,       label: 'Templates' },
  { href: '/conversations', icon: MessageSquare, label: 'Gesprekken' },
]

const MANAGE_ITEMS: NavItem[] = [
  { href: '/analytics',    icon: BarChart2,   label: 'Analyse' },
  { href: '/settings',     icon: Settings,    label: 'Instellingen' },
  { href: '/integrations', icon: Plug,        label: 'Integraties' },
]

interface SidebarProps {
  activeAssistantCount?: number
  userName?: string
  userPlan?: string
}

export function Sidebar({
  activeAssistantCount = 3,
  userName = 'Jaap Hoeve',
  userPlan = 'Pro plan',
}: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const initials = userName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      style={{
        width: 220,
        height: '100vh',
        background: '#FAFBFC',
        borderRight: '0.5px solid #EAECEF',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Logo ── */}
      <div
        style={{
          padding: '16px 14px 14px',
          borderBottom: '0.5px solid #EAECEF',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: TEAL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#0F172A',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              AssistHub
            </p>
            <p
              style={{
                fontSize: 10,
                color: '#9CA3AF',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              AI Platform
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigatie ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 10px',
        }}
      >
        {/* Sectie: Werkruimte */}
        <p
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#C4C9D4',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            margin: '0 0 5px 8px',
          }}
        >
          Werkruimte
        </p>
        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 18px',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {WORKSPACE_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            const badge =
              item.href === '/' && activeAssistantCount > 0
                ? activeAssistantCount
                : undefined

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    height: 34,
                    padding: '0 10px',
                    paddingLeft: active ? 8 : 10,
                    borderRadius: 7,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? '#0F172A' : '#6B7280',
                    background: active ? '#FFFFFF' : 'transparent',
                    border: active ? '0.5px solid #E8EBF0' : '0.5px solid transparent',
                    borderLeft: active ? `2px solid ${TEAL}` : '2px solid transparent',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                >
                  <Icon
                    size={14}
                    strokeWidth={active ? 2 : 1.75}
                    style={{ color: active ? TEAL : '#9CA3AF', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge !== undefined && (
                    <span
                      style={{
                        minWidth: 18,
                        height: 16,
                        padding: '0 5px',
                        borderRadius: 8,
                        background: TEAL,
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Sectie: Beheer */}
        <p
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#C4C9D4',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            margin: '0 0 5px 8px',
          }}
        >
          Beheer
        </p>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {MANAGE_ITEMS.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    height: 34,
                    padding: '0 10px',
                    paddingLeft: active ? 8 : 10,
                    borderRadius: 7,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? '#0F172A' : '#6B7280',
                    background: active ? '#FFFFFF' : 'transparent',
                    border: active ? '0.5px solid #E8EBF0' : '0.5px solid transparent',
                    borderLeft: active ? `2px solid ${TEAL}` : '2px solid transparent',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                >
                  <Icon
                    size={14}
                    strokeWidth={active ? 2 : 1.75}
                    style={{ color: active ? TEAL : '#9CA3AF', flexShrink: 0 }}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Gebruikerchip ── */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '0.5px solid #EAECEF',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: TEAL,
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#0F172A',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userName}
          </p>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{userPlan}</p>
        </div>
      </div>
    </aside>
  )
}

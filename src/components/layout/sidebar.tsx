'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, TrendingUp, Mail, Settings } from 'lucide-react'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  badge?: number
}

interface SidebarProps {
  openReviewCount?: number
}

export function Sidebar({ openReviewCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  const topItems: NavItem[] = [
    { href: '/',         icon: LayoutGrid, label: 'Dashboard' },
    { href: '/activity', icon: TrendingUp, label: 'Activiteit' },
    { href: '/inbox',    icon: Mail,       label: 'Review-inbox', badge: openReviewCount > 0 ? openReviewCount : undefined },
  ]

  const bottomItems: NavItem[] = [
    { href: '/settings', icon: Settings, label: 'Instellingen' },
  ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href)
    const Icon = item.icon

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={item.label}
          aria-label={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            position: 'relative',
            background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: active ? '#3B82F6' : '#94A3B8',
            transition: 'background 0.15s ease, color 0.15s ease',
            textDecoration: 'none',
          }}
        >
          <Icon size={16} />
          {item.badge !== undefined && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#EF4444',
                color: '#fff',
                fontSize: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}
            >
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </Link>
      </li>
    )
  }

  return (
    <aside
      style={{
        width: 52,
        height: '100vh',
        background: '#0F1729',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: '#3B82F6',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>B</span>
      </div>

      {/* Top navigatie */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {topItems.map(renderItem)}
      </ul>

      {/* Bottom navigatie */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bottomItems.map(renderItem)}
      </ul>
    </aside>
  )
}

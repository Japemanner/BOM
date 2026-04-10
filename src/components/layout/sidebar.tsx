'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  Bot,
  Inbox,
  Users,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
}

interface NavSection {
  title: string
  items: NavItem[]
}

interface SidebarProps {
  openReviewCount?: number
}

const getNavSections = (openReviewCount: number): NavSection[] => [
  {
    title: 'Overzicht',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/activity', label: 'Activiteit', icon: Activity },
    ],
  },
  {
    title: 'Assistenten',
    items: [
      { href: '/assistants', label: 'Alle assistenten', icon: Bot },
      {
        href: '/inbox',
        label: 'Review-inbox',
        icon: Inbox,
        badge: openReviewCount > 0 ? openReviewCount : undefined,
      },
    ],
  },
  {
    title: 'Beheer',
    items: [
      { href: '/customers', label: 'Klanten', icon: Users },
      { href: '/settings', label: 'Instellingen', icon: Settings },
    ],
  },
]

export function Sidebar({ openReviewCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const sections = getNavSections(openReviewCount)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <TooltipProvider delay={0}>
      <aside
        className="flex h-screen w-16 flex-col md:w-60 shrink-0 border-r border-slate-800"
        style={{ backgroundColor: '#0F1729' }}
        aria-label="Navigatie"
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-4 border-b border-slate-800">
          <Zap className="h-6 w-6 shrink-0" style={{ color: '#3B82F6' }} />
          <span className="ml-3 hidden md:block text-white font-semibold text-sm tracking-wide">
            BackOffice AI
          </span>
        </div>

        {/* Navigatie */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="hidden md:block px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  return (
                    <li key={item.href}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                              active
                                ? 'text-white'
                                : 'text-slate-400 hover:text-white'
                            )}
                            style={
                              active
                                ? {
                                    backgroundColor: 'rgba(59,130,246,0.2)',
                                    borderLeft: '3px solid #3B82F6',
                                    paddingLeft: '9px',
                                  }
                                : {}
                            }
                            onMouseEnter={(e) => {
                              if (!active)
                                e.currentTarget.style.backgroundColor =
                                  'rgba(255,255,255,0.05)'
                            }}
                            onMouseLeave={(e) => {
                              if (!active)
                                e.currentTarget.style.backgroundColor = ''
                            }}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="hidden md:block">{item.label}</span>
                            {item.badge !== undefined && (
                              <Badge className="ml-auto hidden md:flex h-5 min-w-5 items-center justify-center text-white text-xs bg-blue-500">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="md:hidden">
                          {item.label}
                          {item.badge !== undefined && ` (${item.badge})`}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}

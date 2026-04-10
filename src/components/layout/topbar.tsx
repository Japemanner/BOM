'use client'

import { Bell, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface TopbarProps {
  userName?: string
  tenantName?: string
}

export function Topbar({
  userName = 'Gebruiker',
  tenantName = 'Mijn organisatie',
}: TopbarProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleSignOut = () => {
    void fetch('/api/auth/sign-out', { method: 'POST' }).then(() => {
      window.location.href = '/login'
    })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Links: tenant naam + live indicator */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">{tenantName}</span>

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-slate-500">Live</span>
        </div>
      </div>

      {/* Rechts: notificaties + gebruikersmenu */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-slate-500">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-blue-600 text-xs font-medium bg-blue-50">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm text-slate-700">
                {userName}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => { window.location.href = '/settings' }}>
              Instellingen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={handleSignOut}
            >
              Uitloggen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

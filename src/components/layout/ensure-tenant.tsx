'use client'

import { useEffect, useState } from 'react'

export function EnsureTenant({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/ensure-tenant', { method: 'POST' })
      .then(() => setReady(true))
      .catch(() => setReady(true))
  }, [])

  if (!ready) {
    return null
  }

  return <>{children}</>
}
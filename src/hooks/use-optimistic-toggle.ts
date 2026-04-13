'use client'

import { useState, useCallback } from 'react'
import type { AssistantStatus } from '@/types'

export interface AssistantState {
  id: string
  status: AssistantStatus
}

type PatchFn = (id: string, status: 'active' | 'paused') => Promise<void>

interface UseOptimisticToggleResult {
  states: Map<string, AssistantStatus>
  toggle: (id: string, newStatus: 'active' | 'paused') => Promise<void>
  errorMessage: string | null
  clearError: () => void
}

export function useOptimisticToggle(
  initial: AssistantState[],
  patchFn: PatchFn
): UseOptimisticToggleResult {
  const [states, setStates] = useState<Map<string, AssistantStatus>>(
    () => new Map(initial.map((a) => [a.id, a.status]))
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const toggle = useCallback(
    async (id: string, newStatus: 'active' | 'paused') => {
      const previous = states.get(id)

      // Optimistic update
      setStates((prev) => {
        const next = new Map(prev)
        next.set(id, newStatus)
        return next
      })

      try {
        await patchFn(id, newStatus)
      } catch {
        // Revert on failure
        setStates((prev) => {
          const next = new Map(prev)
          if (previous !== undefined) next.set(id, previous)
          return next
        })
        setErrorMessage('Wijziging mislukt — probeer opnieuw')
      }
    },
    [states, patchFn]
  )

  const clearError = useCallback(() => setErrorMessage(null), [])

  return { states, toggle, errorMessage, clearError }
}

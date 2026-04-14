import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AssistantStatus } from '@/types'

// Sla per assistent-ID de statusoverschrijving op.
// Alleen wijzigingen worden opgeslagen — de standaardstatus blijft in de mock data.
interface AssistantsStore {
  statusOverrides: Record<string, AssistantStatus>
  setStatus: (id: string, status: AssistantStatus) => void
  getStatus: (id: string, defaultStatus: AssistantStatus) => AssistantStatus
}

export const useAssistantsStore = create<AssistantsStore>()(
  persist(
    (set, get) => ({
      statusOverrides: {},

      setStatus: (id, status) =>
        set((state) => ({
          statusOverrides: { ...state.statusOverrides, [id]: status },
        })),

      getStatus: (id, defaultStatus) =>
        get().statusOverrides[id] ?? defaultStatus,
    }),
    {
      name: 'bom-assistants-status', // localStorage key
    },
  ),
)

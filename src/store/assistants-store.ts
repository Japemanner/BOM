import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AssistantStatus } from '@/types'

// Sla per assistent-ID de statusoverschrijving en verwijderingen op.
// Alleen wijzigingen worden opgeslagen — de standaardstatus blijft in de mock data.
interface AssistantsStore {
  statusOverrides: Record<string, AssistantStatus>
  deletedIds: string[]
  setStatus: (id: string, status: AssistantStatus) => void
  getStatus: (id: string, defaultStatus: AssistantStatus) => AssistantStatus
  markDeleted: (id: string) => void
  isDeleted: (id: string) => boolean
}

export const useAssistantsStore = create<AssistantsStore>()(
  persist(
    (set, get) => ({
      statusOverrides: {},
      deletedIds: [],

      setStatus: (id, status) =>
        set((state) => ({
          statusOverrides: { ...state.statusOverrides, [id]: status },
        })),

      getStatus: (id, defaultStatus) =>
        get().statusOverrides[id] ?? defaultStatus,

      markDeleted: (id) =>
        set((state) => ({
          deletedIds: state.deletedIds.includes(id)
            ? state.deletedIds
            : [...state.deletedIds, id],
        })),

      isDeleted: (id) => get().deletedIds.includes(id),
    }),
    {
      name: 'bom-assistants-status', // localStorage key
    },
  ),
)

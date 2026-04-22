import { redirect } from 'next/navigation'
import { HistoryClient } from '@/components/history/history-client'

export default function HistoryPage() {
  // Deze pagina is een thin wrapper; alle data fetching gebeurt in de client
  // component via fetch('/api/history') zodat we pagination kunnen doen zonder
  // server-side query params synchronisatie.
  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <h1 className="text-xl font-semibold text-slate-900 flex-shrink-0">
        Gesprekshistorie
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-6 flex-shrink-0">
        Overzicht van alle gesprekken in deze tenant.
      </p>
      <HistoryClient />
    </div>
  )
}

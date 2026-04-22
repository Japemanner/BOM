'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, MessageSquare, Loader2, AlertCircle } from 'lucide-react'

interface HistoryItem {
  id: string
  assistantId: string
  assistantName: string
  userId: string | null
  userName: string
  status: string
  questionSnippet: string
  answerSnippet: string
  createdAt: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface HistoryResponse {
  items: HistoryItem[]
  pagination: PaginationData
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

function snippet(text: string): string {
  if (text.length <= 80) return text
  return text.slice(0, 80) + '...'
}

export function HistoryClient() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/history?page=${p}&limit=20`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result: HistoryResponse = await res.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(page)
  }, [page, fetchPage])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span className="text-sm">Gesprekken laden...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertCircle className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">Fout bij laden:</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Geen gesprekken gevonden.</p>
        <p className="text-xs text-slate-300 mt-1">
          Start een chat met een assistent om gesprekken te zien.
        </p>
      </div>
    )
  }

  const { pagination } = data

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">Datum</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">User</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">Assistent</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">Vraag</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">Antwoord</th>
                <th className="text-left font-medium text-slate-500 px-4 py-2 text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  data-testid={`history-row-${item.id}`}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/history/${item.id}`)}
                >
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.userName}</td>
                  <td className="px-4 py-3 text-slate-700">{item.assistantName}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                    {snippet(item.questionSnippet)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                    {snippet(item.answerSnippet)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status === 'success'
                        ? 'Succes'
                        : item.status === 'failed'
                          ? 'Mislukt'
                          : item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4 flex-shrink-0">
        <div className="text-xs text-slate-500">
          Pagina {pagination.page} van {pagination.totalPages} ({pagination.total} totaal)
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!pagination.hasPrevPage || loading}
            className="inline-flex items-center px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Vorige
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNextPage || loading}
            className="inline-flex items-center px-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Volgende
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </button>
        </div>
      </div>
    </>
  )
}

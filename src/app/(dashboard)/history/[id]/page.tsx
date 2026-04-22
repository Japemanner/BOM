'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationDetail {
  id: string
  assistantName: string
  userName: string
  status: string
  messages: Message[]
  createdAt: string
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

export default function HistoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : ''

  const [data, setData] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/history/${id}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const result = await res.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Onbekende fout')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span className="text-sm">Gesprek laden...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <AlertCircle className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">{error ?? 'Gesprek niet gevonden'}</p>
        <button
          onClick={() => router.push('/history')}
          className="mt-4 text-xs text-slate-500 hover:text-slate-700"
        >
          Terug naar overzicht
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <button
          onClick={() => router.push('/history')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar overzicht
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-slate-900">
            Gesprek met {data.assistantName}
          </h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              data.status === 'success'
                ? 'bg-green-100 text-green-700'
                : data.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {data.status === 'success' ? 'Succes' : data.status === 'failed' ? 'Mislukt' : data.status}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {data.userName} · {formatDate(data.createdAt)}
        </p>
      </div>

      {/* Chat bubbles */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {data.messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

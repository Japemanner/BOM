'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Bot, User, Clock } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationViewerProps {
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

export function ConversationViewer({
  assistantName,
  userName,
  status,
  messages,
  createdAt,
}: ConversationViewerProps) {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/history')}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar overzicht
        </button>
      </div>

      {/* Meta */}
      <div className="rounded-lg border border-slate-100 bg-white p-4 mb-4">
        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> {userName}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" /> {assistantName}
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {formatDate(createdAt)}
          </span>
          <span className="text-slate-300">·</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              status === 'success'
                ? 'bg-green-100 text-green-700'
                : status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {status === 'success' ? 'Succes' : status === 'failed' ? 'Mislukt' : status}
          </span>
        </div>
      </div>

      {/* Chat bubbles */}
      <div className="space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
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

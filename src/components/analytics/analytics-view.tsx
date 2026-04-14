'use client'

import { useState, useEffect } from 'react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts'

const TEAL = '#1D9E75'

interface DayCount {
  date: string
  active: number
}

interface RecentEvent {
  id: string
  assistantId: string
  assistantName: string
  eventType: 'activated' | 'deactivated'
  createdAt: string
}

interface AnalyticsData {
  dailyCounts: DayCount[]
  recentEvents: RecentEvent[]
}

const PERIOD_OPTIONS = [
  { label: '7 dagen', value: 7 },
  { label: '30 dagen', value: 30 },
  { label: '90 dagen', value: 90 },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function AnalyticsView() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/events/analytics?days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<AnalyticsData>
      })
      .then(setData)
      .catch(() => setError('Kon analytics niet laden'))
      .finally(() => setLoading(false))
  }, [days])

  const activeToday = data?.dailyCounts.at(-1)?.active ?? 0
  const mostActive = data?.recentEvents.reduce<Record<string, number>>((acc, e) => {
    if (e.eventType === 'activated') acc[e.assistantName] = (acc[e.assistantName] ?? 0) + 1
    return acc
  }, {})
  const mostActiveName = mostActive
    ? Object.entries(mostActive).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
    : '—'

  const chartData = data?.dailyCounts.map((d) => ({
    ...d,
    label: formatDate(d.date),
  })) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        height: 52, background: '#fff', borderBottom: '0.5px solid #EAECEF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>Analyse</span>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            height: 32, padding: '0 10px', borderRadius: 7,
            border: '0.5px solid #E2E8F0', fontSize: 12,
            color: '#374151', background: '#fff', cursor: 'pointer',
            fontFamily: 'inherit', outline: 'none',
          }}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats balk */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Totaal events', value: data?.recentEvents.length ?? '—' },
            { label: 'Meest actief',  value: mostActiveName },
            { label: 'Actief vandaag', value: activeToday },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#fff', border: '0.5px solid #EAECEF',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#0F172A', margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Grafiek */}
        <div style={{
          background: '#fff', border: '0.5px solid #EAECEF',
          borderRadius: 12, padding: '20px 16px 12px',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 16px 8px' }}>
            Actieve assistenten per dag
          </p>

          {loading && (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>Laden...</span>
            </div>
          )}

          {error && (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEAL} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(value) => [value, 'Actief']}
                />
                <Area
                  type="monotone" dataKey="active"
                  stroke={TEAL} strokeWidth={2}
                  fill="url(#tealGradient)"
                  dot={{ fill: TEAL, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: TEAL }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recente events feed */}
        <div style={{
          background: '#fff', border: '0.5px solid #EAECEF',
          borderRadius: 12, padding: '16px 20px',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#0F172A', margin: '0 0 12px' }}>
            Recente events
          </p>

          {!loading && data?.recentEvents.length === 0 && (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              Nog geen events — schakel een assistent in of uit om te beginnen.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data?.recentEvents.map((e) => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0', borderBottom: '0.5px solid #F8FAFC',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: e.eventType === 'activated' ? TEAL : '#D1D5DB',
                }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#0F172A' }}>
                  {e.assistantName}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: e.eventType === 'activated' ? TEAL : '#9CA3AF',
                  background: e.eventType === 'activated' ? '#ECFDF5' : '#F3F4F6',
                  padding: '2px 7px', borderRadius: 5,
                }}>
                  {e.eventType === 'activated' ? 'Geactiveerd' : 'Gedeactiveerd'}
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>
                  {formatDateTime(e.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantEvents } from '@/db/schema/app'
import { gte } from 'drizzle-orm'

// Bouw een array van datumstrings voor de afgelopen N dagen
function buildDays(days: number): string[] {
  const result: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push(d.toISOString().slice(0, 10)) // 'YYYY-MM-DD'
  }
  return result
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10), 1), 90)

    const since = new Date()
    since.setDate(since.getDate() - days)
    since.setHours(0, 0, 0, 0)

    // Haal alle events op in de periode
    const events = await db
      .select()
      .from(assistantEvents)
      .where(gte(assistantEvents.createdAt, since))
      .orderBy(assistantEvents.createdAt)

    const dayLabels = buildDays(days)

    // Per dag: welke assistenten waren actief?
    // Strategie: voor elke dag kijken wat het laatste event per assistent was vóór of op die dag
    const allAssistantIds = [...new Set(events.map((e) => e.assistantId))]

    const dailyCounts = dayLabels.map((day) => {
      const endOfDay = new Date(day + 'T23:59:59.999Z')
      let active = 0
      for (const id of allAssistantIds) {
        const assistantEventsForId = events
          .filter((e) => e.assistantId === id && e.createdAt <= endOfDay)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        if (assistantEventsForId[0]?.eventType === 'activated') active++
      }
      return { date: day, active }
    })

    // Haal ook de laatste 20 events op als feed
    const recentEvents = [...events]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        assistantId: e.assistantId,
        assistantName: e.assistantName,
        eventType: e.eventType,
        createdAt: e.createdAt.toISOString(),
      }))

    return NextResponse.json({ dailyCounts, recentEvents })
  } catch (error) {
    console.error('[events/analytics GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

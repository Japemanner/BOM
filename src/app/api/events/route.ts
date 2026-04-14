import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantEvents } from '@/db/schema'
import { z } from 'zod'

const createEventSchema = z.object({
  assistantId: z.string().min(1),
  assistantName: z.string().min(1),
  eventType: z.enum(['activated', 'deactivated']),
})

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { assistantId, assistantName, eventType } = parsed.data

    await db.insert(assistantEvents).values({
      id: crypto.randomUUID(),
      assistantId,
      assistantName,
      eventType,
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('[events POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

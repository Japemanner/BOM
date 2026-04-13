import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { AssistantStatus } from '@/types'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const result = await db.query.assistants.findMany({
      where: eq(assistants.tenantId, DEMO_TENANT_ID),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[assistants GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const createAssistantSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  type: z.string().min(1),
  tenantId: z.string().uuid('Ongeldig tenant ID'),
})

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const parsed = createAssistantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { name, description, type, tenantId } = parsed.data

    const [created] = await db
      .insert(assistants)
      .values({
        tenantId,
        name,
        description,
        type,
        status: AssistantStatus.PAUSED,
        config: {},
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[assistants POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

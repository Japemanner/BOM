import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, assistantTenants } from '@/db/schema/app'
import { inArray, eq } from 'drizzle-orm'
import { z } from 'zod'
import { AssistantStatus } from '@/types'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const linkedIds = db
    .select({ assistantId: assistantTenants.assistantId })
    .from(assistantTenants)
    .where(eq(assistantTenants.tenantId, tenantId))

  try {
    const result = await db
      .select()
      .from(assistants)
      .where(inArray(assistants.id, linkedIds))
      .orderBy(assistants.createdAt)
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
})

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'create')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = createAssistantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { name, description, type } = parsed.data

    const [created] = await db
      .insert(assistants)
      .values({
        name,
        description,
        type,
        status: AssistantStatus.PAUSED,
        config: {},
      })
      .returning()

    if (!created) {
      return NextResponse.json({ error: 'Fout bij aanmaken' }, { status: 500 })
    }

    await db.insert(assistantTenants).values({
      assistantId: created.id,
      tenantId,
    })

    const { webhookTokenEncrypted: _wte, ...safe } = created
    void _wte
    return NextResponse.json(safe, { status: 201 })
  } catch (error) {
    console.error('[assistants POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
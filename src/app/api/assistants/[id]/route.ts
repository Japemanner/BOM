import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { AssistantStatus } from '@/types'
import { encrypt } from '@/lib/crypto'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

const patchSchema = z.object({
  status: z.enum([
    AssistantStatus.ACTIVE,
    AssistantStatus.PAUSED,
    AssistantStatus.ERROR,
  ]).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  type: z.string().min(1).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  webhookToken: z.string().min(1).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Geen velden om te updaten' })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const assistant = await db.query.assistants.findFirst({
      where: and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)),
    })
    if (!assistant) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }
    const { webhookTokenEncrypted: _wte, ...safe } = assistant
    return NextResponse.json(safe)
  } catch (error) {
    console.error('[assistants/[id] GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  const { id } = await params
  try {
    const body: unknown = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { webhookToken, webhookUrl, ...rest } = parsed.data

    const hasWebhookChange = webhookUrl !== undefined || webhookToken
    const requiredPermission = hasWebhookChange ? 'webhooks' : 'assistants'
    const requiredAction = hasWebhookChange ? 'manage' : 'update'

    if (!await canDo(userId, tenantId, requiredPermission, requiredAction)) {
      return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    }
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookToken) updateData.webhookTokenEncrypted = encrypt(webhookToken)

    const [updated] = await db
      .update(assistants)
      .set(updateData)
      .where(and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const { webhookTokenEncrypted: _wte, ...safe } = updated
    return NextResponse.json(safe)
  } catch (error) {
    console.error('[assistants/[id] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'assistants', 'delete')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const [deleted] = await db
      .delete(assistants)
      .where(and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)))
      .returning({ id: assistants.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[assistants/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
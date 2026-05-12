import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { knowledgeSources } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { encrypt } from '@/lib/crypto'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const cfg = source.config as Record<string, unknown>
    return NextResponse.json({
      ...source,
      config: {
        webhookUrl: cfg.webhookUrl ?? null,
        hasToken: !!cfg.webhookTokenEncrypted,
      },
    })
  } catch (error) {
    console.error('[knowledge-sources/[id] GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  config: z.object({
    webhookUrl: z.string().url().optional().or(z.literal('')),
    webhookToken: z.string().optional(),
  }).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Geen velden om te updaten' })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'update')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

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

    // Haal huidige config op zodat we bestaande webhook data niet kwijtraken
    const [current] = await db
      .select({ config: knowledgeSources.config })
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .limit(1)

    if (!current) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const existingCfg = (current.config ?? {}) as Record<string, unknown>

    const mergedConfig: Record<string, unknown> = { ...existingCfg }

    if (parsed.data.config) {
      const { webhookUrl, webhookToken } = parsed.data.config
      if (webhookUrl !== undefined) {
        if (webhookUrl === '') {
          // Wissen: verwijder beide
          delete mergedConfig.webhookUrl
          delete mergedConfig.webhookTokenEncrypted
        } else {
          mergedConfig.webhookUrl = webhookUrl
        }
      }
      if (webhookToken !== undefined && webhookToken !== '') {
        mergedConfig.webhookTokenEncrypted = encrypt(webhookToken)
      }
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      config: mergedConfig,
      updatedAt: new Date(),
    }

    const [updated] = await db
      .update(knowledgeSources)
      .set(updateData)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const cfg = updated.config as Record<string, unknown>
    return NextResponse.json({
      ...updated,
      config: {
        webhookUrl: cfg.webhookUrl ?? null,
        hasToken: !!cfg.webhookTokenEncrypted,
      },
    })
  } catch (error) {
    console.error('[knowledge-sources/[id] PATCH]', error)
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

  if (!await canDo(userId, tenantId, 'knowledge_sources', 'delete')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const { id } = await params
  try {
    const [deleted] = await db
      .delete(knowledgeSources)
      .where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.tenantId, tenantId)))
      .returning({ id: knowledgeSources.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[knowledge-sources/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

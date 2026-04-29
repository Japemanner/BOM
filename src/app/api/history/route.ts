import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns, assistants } from '@/db/schema/app'
import { users } from '@/db/schema/auth'
import { eq, desc, sql } from 'drizzle-orm'
import { getSessionContext } from '@/lib/session'

export async function GET(request: Request) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { tenantId } = ctx

  // Parse query params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  // ── Count total ──────────────────────────────────────────
  // Tenant isolatie via join op assistants (niet via run.tenantId)
  const [countRes] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(assistantRuns)
    .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
    .where(eq(assistants.tenantId, tenantId))

  const total = Number(countRes?.count ?? 0)

  // ── Fetch page ───────────────────────────────────────────
  // NOTE: we lezen userId uit JSON input kolom omdat run.userId
  // mogelijk nog niet bestaat op productie (migratie 0007)
  const rows = await db
    .select({
      id: assistantRuns.id,
      assistantId: assistantRuns.assistantId,
      assistantName: assistants.name,
      status: assistantRuns.status,
      input: assistantRuns.input,
      output: assistantRuns.output,
      createdAt: assistantRuns.createdAt,
    })
    .from(assistantRuns)
    .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
    .where(eq(assistants.tenantId, tenantId))
    .orderBy(desc(assistantRuns.createdAt))
    .limit(limit)
    .offset(offset)

  const items = await Promise.all(
    rows.map(async (r) => {
      const inputData = r.input as Record<string, unknown> | null
      const outputData = r.output as Record<string, unknown> | null

      // Haal userId uit JSON input als het er is
      const userIdFromInput =
        typeof inputData?.userId === 'string' ? inputData.userId : null

      // Look up user naam indien beschikbaar
      let userName = 'Onbekend'
      if (userIdFromInput) {
        try {
          const [dbUser] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, userIdFromInput))
            .limit(1)
          if (dbUser?.name) userName = dbUser.name
        } catch {
          // ignore
        }
      }

      let questionSnippet = ''
      let answerSnippet = ''

      const messages = Array.isArray(outputData?.messages)
        ? outputData.messages
        : null

      if (messages) {
        const userMessages = messages.filter(
          (m: { role: string }) => m.role === 'user'
        )
        const assistantMessages = messages.filter(
          (m: { role: string }) => m.role === 'assistant'
        )
        const lastUserMsg = userMessages[userMessages.length - 1]
        const lastAssistantMsg = assistantMessages[assistantMessages.length - 1]
        if (lastUserMsg?.content)
          questionSnippet = String(lastUserMsg.content).slice(0, 80)
        if (lastAssistantMsg?.content)
          answerSnippet = String(lastAssistantMsg.content).slice(0, 80)
      }

      if (!questionSnippet && inputData?.message) {
        questionSnippet = String(inputData.message).slice(0, 80)
      }
      if (!answerSnippet && outputData?.text) {
        answerSnippet = String(outputData.text).slice(0, 80)
      }

      return {
        id: r.id,
        assistantId: r.assistantId,
        assistantName: r.assistantName ?? 'Onbekend',
        userName,
        status: r.status,
        questionSnippet,
        answerSnippet,
        createdAt: r.createdAt,
      }
    })
  )

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  })
}

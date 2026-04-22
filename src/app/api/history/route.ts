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
  const [countRes] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(assistantRuns)
    .where(eq(assistantRuns.tenantId, tenantId))

  const total = Number(countRes?.count ?? 0)

  // ── Fetch page ───────────────────────────────────────────
  const rows = await db
    .select({
      id: assistantRuns.id,
      assistantId: assistantRuns.assistantId,
      assistantName: assistants.name,
      userId: assistantRuns.userId,
      userName: users.name,
      status: assistantRuns.status,
      input: assistantRuns.input,
      output: assistantRuns.output,
      createdAt: assistantRuns.createdAt,
    })
    .from(assistantRuns)
    .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
    .leftJoin(users, eq(assistantRuns.userId, users.id))
    .where(eq(assistantRuns.tenantId, tenantId))
    .orderBy(desc(assistantRuns.createdAt))
    .limit(limit)
    .offset(offset)

  const items = rows.map((r) => {
    // Extract question snippet from input.message or messages
    const inputData = r.input as Record<string, unknown> | null
    const outputData = r.output as Record<string, unknown> | null

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
      userId: r.userId,
      userName: r.userName ?? 'Onbekend',
      status: r.status,
      questionSnippet,
      answerSnippet,
      createdAt: r.createdAt,
    }
  })

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

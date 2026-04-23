import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns, assistants } from '@/db/schema/app'
import { users } from '@/db/schema/auth'
import { eq, and } from 'drizzle-orm'
import { getSessionContext } from '@/lib/session'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { tenantId } = ctx

  const { id } = await params

  const [row] = await db
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
    .where(
      and(
        eq(assistantRuns.id, id),
        eq(assistants.tenantId, tenantId)
      )
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  }

  const inputData = row.input as Record<string, unknown> | null
  const outputData = row.output as Record<string, unknown> | null

  // User info uit JSON input halen (backward-compat)
  const userId = typeof inputData?.userId === 'string' ? inputData.userId : null

  const messages = Array.isArray(outputData?.messages)
    ? outputData.messages
    : inputData?.message
      ? [
          { role: 'user' as const, content: String(inputData.message) },
          ...(outputData?.text
            ? [{ role: 'assistant' as const, content: String(outputData.text) }]
            : []),
        ]
      : []

  // User naam opzoeken via users tabel (optional, backward-compat)
  let userName = 'Onbekend'
  if (userId) {
    try {
      const [user] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (user?.name) userName = user.name
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    id: row.id,
    assistantId: row.assistantId,
    assistantName: row.assistantName ?? 'Onbekend',
    userId,
    userName,
    status: row.status,
    messages,
    createdAt: row.createdAt,
  })
}

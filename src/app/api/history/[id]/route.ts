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

  return NextResponse.json({
    id: row.id,
    assistantId: row.assistantId,
    assistantName: row.assistantName ?? 'Onbekend',
    userId: row.userId,
    userName: row.userName ?? 'Onbekend',
    status: row.status,
    messages,
    createdAt: row.createdAt,
  })
}

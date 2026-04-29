import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantRuns, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  void _request
  let step = 'init'
  try {
    step = 'auth'
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }
    const userId = session.user.id

    step = 'resolve-params'
    const { runId } = await params

    // ── Haal run op met tenant isolatie via assistent join ──────────
    step = 'fetch-run'
    const [run] = await db
      .select({
        id: assistantRuns.id,
        status: assistantRuns.status,
        runInput: assistantRuns.input,
        runOutput: assistantRuns.output,
        tenantId: assistants.tenantId,
        assistantId: assistantRuns.assistantId,
      })
      .from(assistantRuns)
      .innerJoin(assistants, eq(assistantRuns.assistantId, assistants.id))
      .where(eq(assistantRuns.id, runId))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
    }

    // Tenant-isolatie: gebruiker moet toegang hebben tot deze tenant
    // In praktijk checken we alleen of de run bij deze user hoort
    const input = (run.runInput as { userId?: string }) ?? {}
    if (input.userId && input.userId !== userId) {
      return NextResponse.json({ error: 'Geen toegang tot deze run' }, { status: 403 })
    }

    // ── Return status ─────────────────────────────────────────────────
    if (run.status === 'running') {
      return NextResponse.json({ status: 'running', runId })
    }

    if (run.status === 'success') {
      const output = (run.runOutput as {
        text?: string
        messages?: { role: string; content: string }[]
        meta?: Record<string, unknown>
      }) ?? {}
      return NextResponse.json({
        status: 'success',
        runId,
        text: output.text ?? '',
        messages: output.messages ?? [],
        meta: output.meta ?? {},
      })
    }

    // status: failed | pending
    const output = (run.runOutput as { error?: string }) ?? {}
    return NextResponse.json({
      status: run.status,
      runId,
      error: output.error ?? 'Onbekende fout',
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Interne fout bij status stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

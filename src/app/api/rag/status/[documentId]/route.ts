import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ragDocuments } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { tenantMembers } from '@/db/schema/iam'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
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
    const { documentId } = await params

    // ── Haal document op met tenant membership check ──────────────────
    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        status: ragDocuments.status,
        tenantId: ragDocuments.tenantId,
        assistantId: ragDocuments.assistantId,
        filename: ragDocuments.filename,
        s3Key: ragDocuments.s3Key,
        metadata: ragDocuments.metadata,
        createdAt: ragDocuments.createdAt,
        processedAt: ragDocuments.processedAt,
        errorMessage: ragDocuments.errorMessage,
      })
      .from(ragDocuments)
      .innerJoin(
        tenantMembers,
        and(
          eq(tenantMembers.tenantId, ragDocuments.tenantId),
          eq(tenantMembers.userId, userId)
        )
      )
      .where(eq(ragDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden of geen toegang' }, { status: 404 })
    }

    // ── Return status ─────────────────────────────────────────────────
    return NextResponse.json({
      documentId: doc.id,
      status: doc.status,
      filename: doc.filename,
      createdAt: doc.createdAt,
      processedAt: doc.processedAt,
      errorMessage: doc.errorMessage,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Interne fout bij RAG status stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

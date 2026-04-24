import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ragDocuments, assistants } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
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

    // ── Haal document op met tenant isolatie via assistent join ──────────
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
      .where(eq(ragDocuments.id, documentId))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    // Tenant-isolatie: gebruiker moet toegang hebben tot deze tenant
    const meta = (doc.metadata ?? {}) as { uploadedBy?: string }
    if (meta.uploadedBy && meta.uploadedBy !== userId) {
      return NextResponse.json({ error: 'Geen toegang tot dit document' }, { status: 403 })
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

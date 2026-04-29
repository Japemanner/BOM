import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants, ragDocuments } from '@/db/schema/app'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getPresignedUploadUrl, buildS3Key } from '@/lib/s3'
import { auth } from '@/lib/auth'
import { canDo } from '@/lib/permissions'
import { headers } from 'next/headers'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

const bodySchema = z.object({
  assistantId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string().refine((v) => ALLOWED_TYPES.includes(v), { message: 'Ongeldig bestandstype' }),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES, { message: 'Bestand te groot' }),
})

export async function POST(request: NextRequest) {
  let step = 'init'
  try {
    step = 'auth'
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
    }
    const userId = session.user.id

    step = 'parse-body'
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { assistantId, filename, contentType, fileSize: _fileSize } = parsed.data
    void _fileSize // gevalideerd door Zod, gebruikt voor audit logging

    // ── Haal assistent op + tenant-isolatie ───────────────────────────
    step = 'fetch-assistant'
    const [assistant] = await db
      .select({
        id: assistants.id,
        tenantId: assistants.tenantId,
        config: assistants.config,
      })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1)

    if (!assistant) {
      return NextResponse.json({ error: 'Assistent niet gevonden' }, { status: 404 })
    }

    // ── RBAC: gebruiker moet member/admin van deze tenant zijn ──────
    step = 'rbac'
    if (!await canDo(userId, assistant.tenantId, 'assistants', 'read')) {
      return NextResponse.json({ error: 'Geen toegang tot deze assistent' }, { status: 403 })
    }

    // ── Check of upload enabled is ────────────────────────────────────
    const config = assistant.config as { canUploadFiles?: boolean } ?? {}
    if (!config.canUploadFiles) {
      return NextResponse.json(
        { error: 'Bestanden uploaden is niet geactiveerd voor deze assistent' },
        { status: 403 }
      )
    }

    const tenantId = assistant.tenantId

    // ── Maak ragDocuments record aan ─────────────────────────────────
    step = 'insert-document'
    const [doc] = await db
      .insert(ragDocuments)
      .values({
        tenantId,
        assistantId,
        filename,
        s3Key: '', // tijdelijk, updaten we straks
        status: 'uploaded',
        metadata: { contentType, uploadedBy: userId },
      })
      .returning({ id: ragDocuments.id })

    const documentId = doc?.id
    if (!documentId) {
      return NextResponse.json({ error: 'Fout bij aanmaken document' }, { status: 500 })
    }

    // ── Genereer presigned URL ────────────────────────────────────────
    step = 'presigned-url'
    const s3Key = buildS3Key(tenantId, assistantId, documentId, filename)
    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType, 300)

    // Update s3Key in DB
    await db
      .update(ragDocuments)
      .set({ s3Key })
      .where(eq(ragDocuments.id, documentId))

    return NextResponse.json({ uploadUrl, s3Key, documentId })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Interne fout bij RAG upload stap: ' + step, detail: errMsg },
      { status: 500 }
    )
  }
}

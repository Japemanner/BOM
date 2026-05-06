import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { ragDocuments } from '@/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { buildS3Client, BUCKET } from '@/lib/s3'
import { auth } from '@/lib/auth'
import { canDo } from '@/lib/permissions'
import { headers } from 'next/headers'

const bodySchema = z.object({
  documentId: z.string().uuid(),
  s3Key: z.string().min(1),
  contentType: z.string().min(1),
})

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

async function uploadToS3(key: string, contentType: string, body: Buffer): Promise<void> {
  const client = buildS3Client()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  })
  await client.send(command)
}

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

    step = 'parse-form'
    const formData = await request.formData()
    const file = formData.get('file')
    const rawDocumentId = formData.get('documentId')
    const rawS3Key = formData.get('s3Key')
    const rawContentType = formData.get('contentType')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Bestand ontbreekt' }, { status: 400 })
    }

    const bodyParsed = bodySchema.safeParse({
      documentId: rawDocumentId,
      s3Key: rawS3Key,
      contentType: rawContentType,
    })
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: bodyParsed.error.issues },
        { status: 400 }
      )
    }
    const { documentId, s3Key, contentType } = bodyParsed.data

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json({ error: 'Ongeldig bestandstype' }, { status: 400 })
    }

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Bestand te groot (max 50 MB)' }, { status: 400 })
    }

    step = 'fetch-document'
    const [doc] = await db
      .select({
        id: ragDocuments.id,
        tenantId: ragDocuments.tenantId,
        s3Key: ragDocuments.s3Key,
      })
      .from(ragDocuments)
      .where(and(eq(ragDocuments.id, documentId), eq(ragDocuments.s3Key, s3Key)))
      .limit(1)

    if (!doc) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    step = 'rbac'
    if (!await canDo(userId, doc.tenantId, 'knowledge_sources', 'read')) {
      return NextResponse.json({ error: 'Geen toegang tot deze kennisbron' }, { status: 403 })
    }

    step = 's3-upload'
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await uploadToS3(s3Key, contentType, fileBuffer)

    return NextResponse.json({ documentId })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Interne fout bij proxy-upload stap: ${step}`, detail: errMsg },
      { status: 500 }
    )
  }
}

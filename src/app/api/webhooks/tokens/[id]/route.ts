import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { webhookTokens } from '@/db/schema/app'
import { and, eq } from 'drizzle-orm'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [deleted] = await db
      .delete(webhookTokens)
      .where(and(eq(webhookTokens.id, id), eq(webhookTokens.tenantId, DEMO_TENANT_ID)))
      .returning({ id: webhookTokens.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[webhooks/tokens/[id] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

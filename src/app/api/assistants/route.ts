import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assistants } from '@/db/schema'
import { eq } from 'drizzle-orm'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const result = await db.query.assistants.findMany({
      where: eq(assistants.tenantId, DEMO_TENANT_ID),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[assistants GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

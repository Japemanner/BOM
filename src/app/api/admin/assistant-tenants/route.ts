import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assistantTenants } from '@/db/schema/app'
import { eq, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { isUserSuperAdmin } from '@/lib/permissions'
import { headers } from 'next/headers'

const patchSchema = z.object({
  assistantId: z.string().uuid(),
  tenantId: z.string().uuid(),
  linked: z.boolean(),
})

export async function GET() {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
  }

  if (!await isUserSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const links = await db
    .select({
      assistantId: assistantTenants.assistantId,
      tenantId: assistantTenants.tenantId,
    })
    .from(assistantTenants)
    .orderBy(assistantTenants.assistantId)

  return NextResponse.json(links)
}

export async function PATCH(request: NextRequest) {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
  }

  if (!await isUserSuperAdmin(session.user.id)) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ongeldige invoer', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { assistantId, tenantId, linked } = parsed.data

  const [rowCount] = await db
    .select({ count: count() })
    .from(assistantTenants)
    .where(eq(assistantTenants.assistantId, assistantId))

  const currentCount = rowCount?.count ?? 0

  if (!linked) {
    if (currentCount <= 1) {
      return NextResponse.json(
        { error: 'Elke assistent moet minimaal aan 1 tenant gekoppeld zijn' },
        { status: 400 }
      )
    }

    await db
      .delete(assistantTenants)
      .where(
        and(
          eq(assistantTenants.assistantId, assistantId),
          eq(assistantTenants.tenantId, tenantId)
        )
      )

    return NextResponse.json({ ok: true, linked: false })
  }

  const [existing] = await db
    .select({ assistantId: assistantTenants.assistantId })
    .from(assistantTenants)
    .where(
      and(
        eq(assistantTenants.assistantId, assistantId),
        eq(assistantTenants.tenantId, tenantId)
      )
    )
    .limit(1)

  if (!existing) {
    await db.insert(assistantTenants).values({ assistantId, tenantId })
  }

  return NextResponse.json({ ok: true, linked: true })
}

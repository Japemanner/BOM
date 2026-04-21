import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tenants, tenantMembers } from '@/db/schema/iam'
import { eq } from 'drizzle-orm'
import { getSessionContext } from '@/lib/session'

export async function POST() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId } = ctx

  try {
    const [existing] = await db
      .select({ tenantId: tenantMembers.tenantId })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
      .limit(1)

    if (existing) {
      return NextResponse.json({ ok: true, tenantId: existing.tenantId })
    }

    const email = userId
    const slug = `user-${userId.slice(0, 8)}`

    const [tenant] = await db
      .insert(tenants)
      .values({ name: slug, slug, plan: 'free' })
      .returning({ id: tenants.id })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant aanmaken mislukt' }, { status: 500 })
    }

    await db
      .insert(tenantMembers)
      .values({ tenantId: tenant.id, userId, role: 'admin' })

    return NextResponse.json({ ok: true, tenantId: tenant.id }, { status: 201 })
  } catch (error) {
    console.error('[ensure-tenant]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}
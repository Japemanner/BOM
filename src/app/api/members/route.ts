import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tenantMembers, tenants } from '@/db/schema/iam'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { canDo, isUserSuperAdmin } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  if (!await canDo(userId, tenantId, 'tenant', 'read')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  const superAdmin = await isUserSuperAdmin(userId)
  const requestedTenantId = request.nextUrl.searchParams.get('tenantId')

  if (!superAdmin && requestedTenantId && requestedTenantId !== tenantId) {
    return NextResponse.json({ error: 'Geen toestemming voor deze tenant' }, { status: 403 })
  }

  const targetTenantId = superAdmin
    ? (requestedTenantId ?? null)
    : tenantId

  try {
    const baseQuery = db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: tenantMembers.role,
        joinedAt: tenantMembers.joinedAt,
        tenantId: tenantMembers.tenantId,
        tenantName: tenants.name,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))

    const rows = targetTenantId
      ? await baseQuery.where(eq(tenantMembers.tenantId, targetTenantId)).orderBy(tenantMembers.joinedAt)
      : await baseQuery.orderBy(tenants.name, tenantMembers.joinedAt)

    const result = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      image: r.image,
      role: r.role,
      joinedAt: r.joinedAt.toISOString(),
      tenantId: r.tenantId,
      tenantName: r.tenantName,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[members GET]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

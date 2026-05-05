import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tenantMembers, tenants } from '@/db/schema/iam'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { UserRole } from '@/types'
import { canDo, isUserSuperAdmin } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { auth } from '@/lib/auth'

const createMemberSchema = z.object({
  name: z.string().min(2, 'Naam minimaal 2 tekens'),
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(8, 'Wachtwoord minimaal 8 tekens'),
  role: z.enum([UserRole.ADMIN, UserRole.MEMBER]).default(UserRole.MEMBER),
})

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

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId: currentUserId, tenantId } = ctx

  if (!await canDo(currentUserId, tenantId, 'tenant', 'invite_user')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 })
  }

  const parsed = createMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ongeldige invoer', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { name, email, password, role } = parsed.data

  try {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      const [existingMember] = await db
        .select({ userId: tenantMembers.userId })
        .from(tenantMembers)
        .where(eq(tenantMembers.userId, existingUser.id))
        .limit(1)

      if (existingMember) {
        return NextResponse.json(
          { error: 'Dit e-mailadres is al in gebruik' },
          { status: 409 }
        )
      }
    }

    const signUpResult = await auth.api.signUpEmail({
      body: { name, email, password },
      asResponse: false,
    })

    const newUserId = (signUpResult as { user?: { id?: string } } | null)?.user?.id
    if (!newUserId) {
      return NextResponse.json({ error: 'Gebruiker aanmaken mislukt' }, { status: 500 })
    }

    await db.insert(tenantMembers).values({
      tenantId,
      userId: newUserId,
      role,
    })

    const [newMember] = await db
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
      .where(eq(tenantMembers.userId, newUserId))
      .limit(1)

    if (!newMember) {
      return NextResponse.json({ error: 'Lid niet gevonden na aanmaken' }, { status: 500 })
    }

    return NextResponse.json(
      {
        userId: newMember.userId,
        name: newMember.name,
        email: newMember.email,
        image: newMember.image,
        role: newMember.role,
        joinedAt: newMember.joinedAt.toISOString(),
        tenantId: newMember.tenantId,
        tenantName: newMember.tenantName,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[members POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

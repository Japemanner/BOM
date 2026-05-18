import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tenants, tenantMembers } from '@/db/schema/iam'
import { users } from '@/db/schema/auth'
import { eq } from 'drizzle-orm'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'
import { auth } from '@/lib/auth'
import { createTenantSchema } from '@/lib/validations'
import { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId: currentUserId, tenantId } = ctx

  if (!await canDo(currentUserId, tenantId, 'tenant', 'create')) {
    return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 })
  }

  const parsed = createTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ongeldige invoer', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { name, slug, plan, userName, userEmail, userPassword } = parsed.data

  try {
    const [existingSlug] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)

    if (existingSlug) {
      return NextResponse.json({ error: 'Deze slug is al in gebruik' }, { status: 409 })
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1)

    if (existingUser) {
      return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 })
    }

    const [newTenant] = await db
      .insert(tenants)
      .values({ name, slug, plan })
      .returning({ id: tenants.id })

    if (!newTenant) {
      return NextResponse.json({ error: 'Tenant aanmaken mislukt' }, { status: 500 })
    }

    const signUpResult = await auth.api.signUpEmail({
      body: { name: userName, email: userEmail, password: userPassword },
      asResponse: false,
    })

    const newUserId = (signUpResult as { user?: { id?: string } } | null)?.user?.id
    if (!newUserId) {
      return NextResponse.json({ error: 'Gebruiker aanmaken mislukt' }, { status: 500 })
    }

    await db.insert(tenantMembers).values({
      tenantId: newTenant.id,
      userId: newUserId,
      role: UserRole.ADMIN,
    })

    return NextResponse.json(
      { tenantId: newTenant.id, userId: newUserId, tenantSlug: slug },
      { status: 201 }
    )
  } catch (error) {
    console.error('[tenants POST]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

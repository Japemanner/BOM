import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tenantMembers } from '@/db/schema/iam'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { UserRole } from '@/types'
import { canDo, isUserSuperAdmin } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

const patchSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.MEMBER]),
})

function noPermission() {
  return NextResponse.json({ error: 'Geen toestemming' }, { status: 403 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId: currentUserId, tenantId: currentTenantId } = ctx

  if (!await canDo(currentUserId, currentTenantId, 'tenant', 'update_member_role')) {
    return noPermission()
  }

  const { userId: targetUserId } = await params

  const superAdmin = await isUserSuperAdmin(currentUserId)
  const requestedTenantId = request.nextUrl.searchParams.get('tenantId')

  const targetTenantId = superAdmin && requestedTenantId
    ? requestedTenantId
    : currentTenantId

  if (!superAdmin && targetTenantId !== currentTenantId) {
    return noPermission()
  }

  try {
    const body: unknown = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', details: parsed.error.issues },
        { status: 400 }
      )
    }

    if (targetUserId === currentUserId && targetTenantId === currentTenantId) {
      return NextResponse.json(
        { error: 'Je kunt je eigen rol niet wijzigen' },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(tenantMembers)
      .set({ role: parsed.data.role })
      .where(
        and(
          eq(tenantMembers.userId, targetUserId),
          eq(tenantMembers.tenantId, targetTenantId)
        )
      )
      .returning({ userId: tenantMembers.userId, role: tenantMembers.role })

    if (!updated) {
      return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[members/[userId] PATCH]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId: currentUserId, tenantId: currentTenantId } = ctx

  if (!await canDo(currentUserId, currentTenantId, 'tenant', 'remove_user')) {
    return noPermission()
  }

  const { userId: targetUserId } = await params

  const superAdmin = await isUserSuperAdmin(currentUserId)
  const requestedTenantId = request.nextUrl.searchParams.get('tenantId')

  const targetTenantId = superAdmin && requestedTenantId
    ? requestedTenantId
    : currentTenantId

  if (!superAdmin && targetTenantId !== currentTenantId) {
    return noPermission()
  }

  if (targetUserId === currentUserId && targetTenantId === currentTenantId) {
    return NextResponse.json(
      { error: 'Je kunt jezelf niet verwijderen' },
      { status: 400 }
    )
  }

  try {
    const [deleted] = await db
      .delete(tenantMembers)
      .where(
        and(
          eq(tenantMembers.userId, targetUserId),
          eq(tenantMembers.tenantId, targetTenantId)
        )
      )
      .returning({ userId: tenantMembers.userId })

    if (!deleted) {
      return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[members/[userId] DELETE]', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

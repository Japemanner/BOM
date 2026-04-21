import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { tenantMembers } from '@/db/schema/iam'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export interface SessionContext {
  userId: string
  tenantId: string
}

/**
 * Haal sessieContext op in API route handlers.
 * Retourneert NextResponse bij fout (401/403) — direct retourneren in de route.
 */
export async function getSessionContext(): Promise<SessionContext | NextResponse> {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geauthenticeerd' }, { status: 401 })
  }

  const userId = session.user.id

  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1)

  if (!membership) {
    return NextResponse.json({ error: 'Geen tenant-lidmaatschap' }, { status: 403 })
  }

  return { userId, tenantId: membership.tenantId }
}

/**
 * Haal sessieContext op in Server Components.
 * Retourneert null bij fout — redirect in de component.
 */
export async function getSessionContextOrNull(): Promise<SessionContext | null> {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })

  if (!session?.user?.id) return null

  const userId = session.user.id

  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1)

  if (!membership) return null

  return { userId, tenantId: membership.tenantId }
}
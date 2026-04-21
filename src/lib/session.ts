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

export type SessionFailReason = 'not_authenticated' | 'no_tenant' | 'db_error'

export interface SessionResult {
  ok: true
  userId: string
  tenantId: string
}

export interface SessionFailResult {
  ok: false
  reason: SessionFailReason
  userId?: string
}

export type SessionOutcome = SessionResult | SessionFailResult

/**
 * Haal sessieContext op in API route handlers.
 * Retourneert NextResponse bij fout (401/403) — direct retourneren in de route.
 */
export async function getSessionContext(): Promise<SessionContext | NextResponse> {
  try {
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
  } catch (error) {
    console.error('[getSessionContext] DB of auth fout:', error)
    return NextResponse.json({ error: 'Interne fout' }, { status: 500 })
  }
}

/**
 * Haal sessieContext op in Server Components.
 * Retourneert een SessionOutcome met gedetailleerde reden bij fout.
 */
export async function getSessionOutcome(): Promise<SessionOutcome> {
  try {
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })

    if (!session?.user?.id) {
      return { ok: false, reason: 'not_authenticated' }
    }

    const userId = session.user.id

    const [membership] = await db
      .select({ tenantId: tenantMembers.tenantId })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
      .limit(1)

    if (!membership) {
      return { ok: false, reason: 'no_tenant', userId }
    }

    return { ok: true, userId, tenantId: membership.tenantId }
  } catch (error) {
    console.error('[getSessionOutcome] DB of auth fout:', error)
    return { ok: false, reason: 'db_error' }
  }
}

/**
 * Backwards-compat: retourneert null bij elke fout.
 * Gebruik getSessionOutcome() voor gedetailleerde fout-afhandeling.
 */
export async function getSessionContextOrNull(): Promise<SessionContext | null> {
  const result = await getSessionOutcome()
  if (!result.ok) return null
  return { userId: result.userId, tenantId: result.tenantId }
}
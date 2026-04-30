import { NextResponse } from 'next/server'
import { canDo } from '@/lib/permissions'
import { getSessionContext } from '@/lib/session'

/**
 * GET /api/diagnostics/rbac
 * Retourneert de effectieve permissies en rol van de ingelogde gebruiker.
 * Alleen voor debugging — geen RBAC-check op deze route zelf.
 */
export async function GET() {
  const ctx = await getSessionContext()
  if (ctx instanceof NextResponse) return ctx
  const { userId, tenantId } = ctx

  try {
    const checks: { resource: string; action: string; name: string }[] = [
      { resource: 'assistants', action: 'read', name: 'assistants.read' },
      { resource: 'assistants', action: 'create', name: 'assistants.create' },
      { resource: 'assistants', action: 'update', name: 'assistants.update' },
      { resource: 'assistants', action: 'delete', name: 'assistants.delete' },
      { resource: 'assistants', action: 'toggle_status', name: 'assistants.toggle_status' },
      { resource: 'knowledge_sources', action: 'read', name: 'knowledge_sources.read' },
      { resource: 'knowledge_sources', action: 'create', name: 'knowledge_sources.create' },
      { resource: 'knowledge_sources', action: 'update', name: 'knowledge_sources.update' },
      { resource: 'knowledge_sources', action: 'delete', name: 'knowledge_sources.delete' },
      { resource: 'integrations', action: 'read', name: 'integrations.read' },
      { resource: 'webhooks', action: 'manage', name: 'webhooks.manage' },
    ]

    const results = await Promise.all(
      checks.map(async ({ resource, action, name }) => ({
        name,
        hasAccess: await canDo(userId, tenantId, resource, action),
      }))
    )

    return NextResponse.json({
      userId,
      tenantId,
      permissions: results.reduce<Record<string, boolean>>((acc, r) => {
        acc[r.name] = r.hasAccess
        return acc
      }, {}),
    })
  } catch (error) {
    console.error('[diagnostics/rbac]', error)
    return NextResponse.json({ error: 'Diagnostics mislukt' }, { status: 500 })
  }
}

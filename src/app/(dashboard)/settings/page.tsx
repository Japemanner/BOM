import { redirect } from 'next/navigation'
import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { assistants, webhookTokens } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import type { AssistantStatus } from '@/types'
import { getSessionContextOrNull } from '@/lib/session'

async function getData(tenantId: string) {
  try {
    const [allAssistants, allTenants, allInboundTokens] = await Promise.all([
      db.select().from(assistants)
        .where(eq(assistants.tenantId, tenantId))
        .orderBy(assistants.createdAt),
      db.select().from(tenants).orderBy(tenants.name),
      db.select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        assistantId: webhookTokens.assistantId,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      }).from(webhookTokens).where(eq(webhookTokens.tenantId, tenantId)),
    ])
    return { allAssistants, allTenants, allInboundTokens }
  } catch {
    return { allAssistants: [], allTenants: [], allInboundTokens: [] }
  }
}

export default async function SettingsPage() {
  const ctx = await getSessionContextOrNull()
  if (!ctx) redirect('/login')

  const { allAssistants, allTenants, allInboundTokens } = await getData(ctx.tenantId)

  const assistantsData = allAssistants.map(({ webhookTokenEncrypted: _wte, ...a }) => ({
    ...a,
    status: a.status as AssistantStatus,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))

  const tenantsData = allTenants.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  const inboundTokensData = allInboundTokens.map((t) => ({
    ...t,
    assistantId: t.assistantId ?? null,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          height: 52,
          background: '#fff',
          borderBottom: '0.5px solid #EAECEF',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
          Instellingen
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 840 }}>
          <SettingsTabs assistants={assistantsData} tenants={tenantsData} inboundTokens={inboundTokensData} />
        </div>
      </div>
    </div>
  )
}
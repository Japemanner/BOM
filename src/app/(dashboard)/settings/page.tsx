import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { assistants, webhookTokens } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import type { AssistantStatus } from '@/types'

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function getData() {
  try {
    const [allAssistants, allTenants, allWebhookTokens] = await Promise.all([
      db.select().from(assistants).orderBy(assistants.createdAt),
      db.select().from(tenants).orderBy(tenants.name),
      db.select({
        id: webhookTokens.id,
        name: webhookTokens.name,
        createdAt: webhookTokens.createdAt,
        lastUsedAt: webhookTokens.lastUsedAt,
      }).from(webhookTokens).where(eq(webhookTokens.tenantId, DEMO_TENANT_ID)),
    ])
    return { allAssistants, allTenants, allWebhookTokens }
  } catch {
    return { allAssistants: [], allTenants: [], allWebhookTokens: [] }
  }
}

export default async function SettingsPage() {
  const { allAssistants, allTenants, allWebhookTokens } = await getData()

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

  const webhookTokensData = allWebhookTokens.map((t) => ({
    ...t,
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
          <SettingsTabs assistants={assistantsData} tenants={tenantsData} webhookTokens={webhookTokensData} />
        </div>
      </div>
    </div>
  )
}

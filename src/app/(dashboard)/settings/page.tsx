import { db } from '@/db'
import { assistants } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { SettingsTabs } from '@/components/settings/settings-tabs'

async function getData() {
  try {
    const [allAssistants, allTenants] = await Promise.all([
      db.select().from(assistants).orderBy(assistants.createdAt),
      db.select().from(tenants).orderBy(tenants.name),
    ])
    return { allAssistants, allTenants }
  } catch {
    // DB niet beschikbaar (bijv. CI zonder database) — lege arrays teruggeven
    // zodat demo-assistenten in AssistentenBeheer nog wel zichtbaar zijn
    return { allAssistants: [], allTenants: [] }
  }
}

export default async function SettingsPage() {
  const { allAssistants, allTenants } = await getData()

  const assistantsData = allAssistants.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))

  const tenantsData = allTenants.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar — zelfde stijl als dashboard */}
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

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 840 }}>
          <SettingsTabs assistants={assistantsData} tenants={tenantsData} />
        </div>
      </div>
    </div>
  )
}

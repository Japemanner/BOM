import { redirect } from 'next/navigation'
import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { assistants } from '@/db/schema/app'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import type { AssistantStatus } from '@/types'
import { getSessionOutcome } from '@/lib/session'

async function getData(tenantId: string) {
  try {
    const allAssistants = await db
      .select()
      .from(assistants)
      .where(eq(assistants.tenantId, tenantId))
      .orderBy(assistants.createdAt)
    return { allAssistants }
  } catch {
    return { allAssistants: [] }
  }
}

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        height: 52,
        background: '#fff',
        borderBottom: '0.5px solid #EAECEF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
          Instellingen
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>{message}</p>
          <a href="/" style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 8,
            background: '#3B82F6', color: '#fff', textDecoration: 'none', fontSize: 14,
          }}>
            Terug naar dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

export default async function SettingsPage() {
  const result = await getSessionOutcome()

  if (!result.ok) {
    switch (result.reason) {
      case 'not_authenticated':
        redirect('/login')
      case 'no_tenant':
        return <ErrorPage
          title="Geen organisatie gekoppeld"
          message="Je account is nog niet gekoppeld aan een organisatie."
        />
      case 'db_error':
        return <ErrorPage
          title="Tijdelijke fout"
          message="Er is een probleem met de databaseverbinding."
        />
    }
  }

  const { allAssistants } = await getData(result.tenantId)

  const assistantsData = allAssistants.map(({ webhookTokenEncrypted: _wte, ...a }) => ({
    ...a,
    status: a.status as AssistantStatus,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
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
          <SettingsTabs assistants={assistantsData} />
        </div>
      </div>
    </div>
  )
}
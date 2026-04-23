import { redirect } from 'next/navigation'
import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { assistants, webhookTokens } from '@/db/schema/app'
import { tenants } from '@/db/schema/iam'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import type { AssistantStatus } from '@/types'
import { getSessionOutcome } from '@/lib/session'

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

function ErrorPage({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="h-screen bg-slate-50 flex flex-col items-center justify-center p-10"
    >
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  )
}

export default async function AdminPage() {
  const result = await getSessionOutcome()

  if (!result.ok) {
    if (result.reason === 'not_authenticated') {
      redirect('/login')
    }
    return (
      <ErrorPage
        title="Geen toegang"
        message="Je hebt geen rechten om deze pagina te bekijken."
      />
    )
  }

  const { allAssistants, allTenants, allInboundTokens } = await getData(
    result.tenantId
  )

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
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="flex-shrink-0 h-[52px] bg-white border-b border-slate-100 flex items-center px-5">
        <span className="text-sm font-medium text-slate-900">Admin</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AdminDashboard
          assistants={assistantsData}
          tenants={tenantsData}
          inboundTokens={inboundTokensData}
        />
      </div>
    </div>
  )
}

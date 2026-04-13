import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8FAFC' }}>
      <Sidebar openReviewCount={8} />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar userName="Jaap Hoeve" openReviewCount={8} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</main>
      </div>
    </div>
  )
}

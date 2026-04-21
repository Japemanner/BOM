import { Sidebar } from '@/components/layout/sidebar'
import { EnsureTenant } from '@/components/layout/ensure-tenant'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#F7F8FA',
        fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <Sidebar />
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <EnsureTenant>{children}</EnsureTenant>
      </div>
    </div>
  )
}
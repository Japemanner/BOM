import { Sidebar } from '@/components/layout/sidebar'

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
      <Sidebar activeAssistantCount={3} />
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

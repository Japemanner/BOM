import { DM_Sans } from 'next/font/google'
import { Sidebar } from '@/components/layout/sidebar'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={dmSans.className}
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#F7F8FA',
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

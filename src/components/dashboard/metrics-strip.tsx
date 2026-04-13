import { Clock, CheckCircle2, List, Bell } from 'lucide-react'

export interface MetricsData {
  savedMinutes: number
  activeCount: number
  totalCount: number
  runsToday: number
  openReviewCount: number
}

interface MetricsStripProps {
  metrics: MetricsData
}

interface CardDef {
  icon: React.ElementType
  iconBg: string
  value: string
  label: string
}

function buildCards(m: MetricsData): CardDef[] {
  const hours = (m.savedMinutes / 60).toFixed(1)
  return [
    {
      icon: Clock,
      iconBg: '#EFF6FF',
      value: `${hours}u`,
      label: 'bespaard vandaag',
    },
    {
      icon: CheckCircle2,
      iconBg: '#F0FDF4',
      value: `${m.activeCount} actief van ${m.totalCount}`,
      label: 'assistenten',
    },
    {
      icon: List,
      iconBg: '#F8FAFC',
      value: String(m.runsToday),
      label: 'taken vandaag',
    },
    {
      icon: Bell,
      iconBg: '#FEF2F2',
      value: String(m.openReviewCount),
      label: 'wachten op review',
    },
  ]
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  const cards = buildCards(metrics)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}
      className="metrics-strip"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            style={{
              background: '#fff',
              border: '0.5px solid #E2E8F0',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: card.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={14} color="#64748B" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 16,
                  fontFamily: 'monospace',
                  color: '#0F172A',
                  margin: 0,
                  lineHeight: 1.2,
                  fontWeight: 600,
                }}
              >
                {card.value}
              </p>
              <p style={{ fontSize: 10, color: '#94A3B8', margin: '2px 0 0' }}>
                {card.label}
              </p>
            </div>
          </div>
        )
      })}

      <style>{`
        @media (max-width: 767px) {
          .metrics-strip {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}

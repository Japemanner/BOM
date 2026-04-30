'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error('[ErrorBoundary] React component crash:', error.message, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, padding: '48px 24px', textAlign: 'center',
        }}>
          <AlertTriangle size={28} color="#EF4444" />
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#0F172A', margin: '0 0 4px' }}>
              Er is iets misgegaan
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              {this.state.error?.message ?? 'Onbekende fout'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              height: 30, padding: '0 14px', borderRadius: 7,
              background: '#F3F4F6', border: '0.5px solid #E2E8F0',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151',
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

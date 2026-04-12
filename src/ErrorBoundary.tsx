import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DewDrops render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#0a0a0c',
            color: '#f5f5f7',
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Something went wrong</h1>
          <p style={{ margin: 0, maxWidth: 420, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
            The board hit an unexpected error. Reload the page. If it keeps happening, clear saved data
            with the reset control after reload, or open the console for details.
          </p>
          <button
            type="button"
            style={{
              marginTop: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(120,200,255,0.4)',
              background: 'rgba(10,132,255,0.2)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

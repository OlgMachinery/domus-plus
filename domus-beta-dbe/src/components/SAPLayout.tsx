import type { ReactNode } from 'react'

type SAPLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
  /** Modo ultra compacto: header mínimo y poco padding para dar todo el espacio al contenido (p. ej. diagrama) */
  compact?: boolean
}

export default function SAPLayout({ title, subtitle, children, compact = false }: SAPLayoutProps) {
  return (
    <div
      style={{
        minHeight: compact ? undefined : '100vh',
        height: compact ? '100dvh' : undefined,
        maxHeight: compact ? '100dvh' : undefined,
        display: compact ? 'flex' : 'block',
        flexDirection: compact ? 'column' : undefined,
        overflow: compact ? 'hidden' : undefined,
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          padding: compact ? '4px 12px 4px' : '8px 20px 6px',
          borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
          background: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: compact ? 14 : 18, fontWeight: 800, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && !compact ? (
            <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 13, fontWeight: 500 }}>{subtitle}</p>
          ) : null}
        </div>
      </header>

      <main
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: compact ? '4px 12px 8px' : '10px 20px 16px',
          flex: compact ? 1 : undefined,
          minHeight: compact ? 0 : undefined,
          overflow: compact ? 'hidden' : undefined,
          display: compact ? 'flex' : 'block',
          flexDirection: compact ? 'column' : undefined,
        }}
      >
        {children}
      </main>
    </div>
  )
}

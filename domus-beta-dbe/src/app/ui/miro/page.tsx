'use client'

const boardUrl = process.env.NEXT_PUBLIC_MIRO_BOARD_URL || ''

export default function MiroEmbedPage() {
  const hasUrl = !!boardUrl

  return (
    <main
      style={{
        width: '100%',
        minHeight: '90vh',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Miro (embed)</h1>
          <p style={{ margin: '4px 0 0', color: '#475569' }}>Visualiza tu board de Miro dentro de DOMUS.</p>
        </div>
        <span
          style={{
            padding: '6px 10px',
            borderRadius: 10,
            background: hasUrl ? '#dcfce7' : '#fef3c7',
            color: hasUrl ? '#166534' : '#92400e',
            fontWeight: 700,
            border: hasUrl ? '1px solid #bbf7d0' : '1px solid #fcd34d',
          }}
        >
          {hasUrl ? 'URL configurada' : 'Falta URL'}
        </span>
      </header>

      {!hasUrl ? (
        <div
          style={{
            padding: 16,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#f8fafc',
            color: '#0f172a',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Configura la URL del board</p>
          <p style={{ margin: '6px 0 0' }}>
            Define la variable <code>NEXT_PUBLIC_MIRO_BOARD_URL</code> en tu entorno (por ejemplo en <code>.env</code>) con la
            URL de tu board de Miro (live embed). Luego vuelve a cargar esta página.
          </p>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            flex: 1,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <iframe
            src={boardUrl}
            style={{ width: '100%', height: '90vh', border: 'none' }}
            allowFullScreen
            title="Miro Board"
          />
        </div>
      )}
    </main>
  )
}

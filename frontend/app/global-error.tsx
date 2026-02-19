'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Error Crítico - Domus Fam</title>
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <h2 style={{ fontSize: '28px', marginBottom: '16px', color: '#111827' }}>
            Error Crítico del Sistema
          </h2>
          <p style={{ color: '#dc2626', margin: '20px 0', fontSize: '16px', maxWidth: '600px' }}>
            {error.message || 'Ha ocurrido un error crítico en la aplicación'}
          </p>
          {error.digest && (
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px' }}>
              Código: {error.digest}
            </p>
          )}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Reiniciar
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error para debugging
    console.error('❌ [ERROR BOUNDARY] Error capturado:', error)
    console.error('   Mensaje:', error.message)
    console.error('   Stack:', error.stack)
    if (error.digest) {
      console.error('   Digest:', error.digest)
    }
  }, [error])

  return (
    <html lang="es">
      <body>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>¡Algo salió mal!</h2>
          <p style={{ color: '#dc2626', margin: '20px 0', fontSize: '16px' }}>
            {error.message || 'Error desconocido'}
          </p>
          {error.digest && (
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '8px' }}>
              Código de error: {error.digest}
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
              Intentar de nuevo
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

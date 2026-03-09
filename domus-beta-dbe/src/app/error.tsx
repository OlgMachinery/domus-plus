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
    console.error('Application error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 20, color: '#b91c1c', marginBottom: 8 }}>
        Algo salió mal
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16, maxWidth: 400 }}>
        Se produjo un error en la aplicación. Revisa la consola del navegador (F12 → Console) para más detalles.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: '#2563eb',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  )
}

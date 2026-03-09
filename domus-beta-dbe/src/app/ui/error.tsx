'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Error en /ui:', error)
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
        Error en la aplicación
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16, maxWidth: 400 }}>
        Si estabas extrayendo un ticket o guardando datos, intenta de nuevo. Si el error sigue, recarga la página.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
        <button
          type="button"
          onClick={() => router.push('/ui')}
          style={{
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            color: '#374151',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Volver a Inicio
        </button>
      </div>
    </div>
  )
}

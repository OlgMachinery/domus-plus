'use client'

import { useState } from 'react'
import Link from 'next/link'

async function postJson(url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.detail || data?.message || 'Error')
  return data
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!email.trim() || !email.includes('@')) {
      setMessage('Introduce tu email.')
      return
    }
    setLoading(true)
    try {
      await postJson('/api/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
    } catch (err: any) {
      setMessage(err?.message || 'Error al enviar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f1f5f9)' }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Restablecer contraseña</h1>
        <p style={{ color: 'var(--muted, #64748b)', marginBottom: 24 }}>
          Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña (válido 24 h).
        </p>
        {sent ? (
          <p style={{ color: 'var(--success, #0d9488)', marginBottom: 24 }}>
            Si ese correo está registrado, recibirás un enlace en breve. Revisa tu bandeja y spam.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label>
              Email
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                style={{ width: '100%', marginTop: 6 }}
                required
              />
            </label>
            {message && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 14 }}>{message}</p>}
            <button type="submit" className="btn btnPrimary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <p style={{ marginTop: 24, fontSize: 14 }}>
          <Link href="/ui">← Volver al inicio de sesión</Link>
        </p>
      </div>
    </main>
  )
}

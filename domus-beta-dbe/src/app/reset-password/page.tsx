'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get('token')?.trim() || ''

  const [token, setToken] = useState(tokenFromUrl)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setToken(tokenFromUrl)
  }, [tokenFromUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!token) {
      setMessage('Falta el token. Usa el enlace que te enviamos por correo.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await postJson('/api/auth/reset-password', { token, newPassword })
      setDone(true)
      setTimeout(() => router.push('/ui'), 2000)
    } catch (err: any) {
      setMessage(err?.message || 'Error al restablecer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f1f5f9)' }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Nueva contraseña</h1>
        <p style={{ color: 'var(--muted, #64748b)', marginBottom: 24 }}>
          Introduce tu nueva contraseña (mínimo 6 caracteres).
        </p>
        {done ? (
          <p style={{ color: 'var(--success, #0d9488)' }}>Contraseña actualizada. Redirigiendo al inicio de sesión…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!tokenFromUrl && (
              <label>
                Token (pega el que te llegó por correo)
                <input
                  className="input"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Token del enlace"
                  style={{ width: '100%', marginTop: 6 }}
                />
              </label>
            )}
            <label>
              Nueva contraseña
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                style={{ width: '100%', marginTop: 6 }}
                required
                minLength={6}
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                style={{ width: '100%', marginTop: 6 }}
                required
              />
            </label>
            {message && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 14 }}>{message}</p>}
            <button type="submit" className="btn btnPrimary" disabled={loading}>
              {loading ? 'Guardando…' : 'Restablecer contraseña'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/** Convierte la respuesta de error del backend (string o array de validación) a un mensaje de texto. */
function apiErrorToMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((item: { msg?: string; loc?: unknown[] }) => {
      if (!item || typeof item.msg !== 'string') return ''
      const field = Array.isArray(item.loc) ? item.loc.filter((x): x is string => typeof x === 'string').pop() : null
      return field ? `${field}: ${item.msg}` : item.msg
    }).filter(Boolean)
    return messages.length ? messages.join('. ') : 'Error de validación. Revisa los campos.'
  }
  return 'Error al registrar usuario'
}

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validaciones
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError('Todos los campos son requeridos')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    if (phone.length < 10) {
      setError('El teléfono debe tener al menos 10 caracteres')
      setLoading(false)
      return
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    }
    const url = '/api/auth/register'
    const opts: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? { signal: AbortSignal.timeout(30000) }
        : {}),
    }

    let lastErr: unknown
    const maxRetries = 2
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url, opts)
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setError(apiErrorToMessage(data.detail))
          setLoading(false)
          return
        }

        router.push('/login?registered=true')
        return
      } catch (err) {
        lastErr = err
        if (i < maxRetries) await new Promise((r) => setTimeout(r, 800))
      }
    }

    const msg = lastErr && typeof (lastErr as Error).message === 'string' ? (lastErr as Error).message : ''
    if (/fetch\s*failed|load\s*failed|failed\s*to\s*fetch|network|timeout/i.test(msg)) {
      setError('No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
    } else {
      setError('Error al registrar usuario. Verifica tu conexión e inténtalo de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sap-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full sap-card p-8 shadow-elevation-2">
        <div className="text-center mb-8">
          <h1 className="text-display font-semibold text-sap-text tracking-tight">Domus Fam</h1>
          <p className="text-body text-sap-text-secondary mt-2">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="space-y-2">
              <div className="sap-alert-error text-center" role="alert">
                {error}
              </div>
              <p className="text-xs text-sap-text-secondary text-center">
                Si el error persiste:{' '}
                <a href="/api/health" target="_blank" rel="noopener noreferrer" className="text-sap-primary underline">
                  comprueba si el servidor responde
                </a>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sap-input"
              placeholder="Tu nombre completo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sap-input"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="sap-input"
              placeholder="+526865690472"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sap-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-sap-text-tertiary mt-1">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Confirmar Contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="sap-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sap-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-sap-text-secondary">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-sap-primary hover:text-sap-primary-hover font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

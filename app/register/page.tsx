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

export const dynamic = 'force-dynamic'

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [belongsToFamily, setBelongsToFamily] = useState<'yes' | 'no'>('no')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validaciones
    if (!name || !email || !phone || !city?.trim() || !password || !confirmPassword) {
      setError('Todos los campos son requeridos (nombre, email, teléfono, ciudad, contraseña)')
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
      city: city.trim() || undefined,
      belongs_to_family: belongsToFamily === 'yes',
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
          <p className="text-xs text-sap-text-tertiary mt-3 max-w-sm mx-auto">
            Teléfono, correo, ciudad y si perteneces a una familia son necesarios para la app y para que funcione el envío de comprobantes por WhatsApp (Twilio).
          </p>
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
            <label className="block text-sm font-medium text-sap-text mb-1">Teléfono <span className="text-sap-text-tertiary font-normal">(requerido)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="sap-input"
              placeholder="+52 686 569 0472"
              required
              minLength={10}
            />
            <p className="text-xs text-sap-text-tertiary mt-1">Mínimo 10 dígitos. Se usa para identificar tu cuenta y enviar comprobantes por WhatsApp.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">Ciudad <span className="text-sap-text-tertiary font-normal">(requerido)</span></label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="sap-input"
              placeholder="Ej. Hermosillo, CDMX"
              required
            />
            <p className="text-xs text-sap-text-tertiary mt-1">Requerido para la app y para comprobantes por WhatsApp.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-sap-text mb-1">¿Perteneces a una familia?</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="belongs_to_family"
                  checked={belongsToFamily === 'yes'}
                  onChange={() => setBelongsToFamily('yes')}
                  className="text-sap-primary"
                />
                <span className="text-sm text-sap-text">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="belongs_to_family"
                  checked={belongsToFamily === 'no'}
                  onChange={() => setBelongsToFamily('no')}
                  className="text-sap-primary"
                />
                <span className="text-sm text-sap-text">No</span>
              </label>
            </div>
            <p className="text-xs text-sap-text-tertiary mt-1">Sí = ya tienes o crearás una familia. No = registrarás solo tú. Afecta invitaciones y comprobantes por WhatsApp.</p>
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { getAuthHeaders } from '@/lib/auth'

async function loginViaApi(email: string, password: string, retries = 2): Promise<{ ok: boolean; detail?: string; accessToken?: string }> {
  const url = '/api/auth/login'
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
    ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? { signal: AbortSignal.timeout(25000) }
      : {}),
  }
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, detail: data.detail || 'Error al iniciar sesión' }
      const token = (data as { access_token?: string }).access_token
      if (token && typeof localStorage !== 'undefined') {
        localStorage.setItem('domus_token', token)
      }
      return { ok: true, accessToken: token }
    } catch (e) {
      lastErr = e
      if (i < retries) await new Promise((r) => setTimeout(r, 800))
    }
  }
  const msg = lastErr && typeof (lastErr as Error).message === 'string' ? (lastErr as Error).message : ''
  if (/fetch\s*failed|load\s*failed|failed\s*to\s*fetch|network|timeout/i.test(msg)) {
    return { ok: false, detail: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.' }
  }
  return { ok: false, detail: msg || 'Error de conexión. Intenta de nuevo.' }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Si ya hay sesión válida, no mostrar login (evita “rebotes” inesperados a /login)
  useEffect(() => {
    if (typeof window === 'undefined') return
    getAuthHeaders()
      .then((headers) =>
        fetch('/api/users/me', {
          credentials: 'include',
          headers: headers as Record<string, string>,
        })
      )
      .then((res) => {
        if (res.ok) {
          router.replace('/dashboard')
        }
      })
      .catch(() => {})
  }, [router])

  const handleDemoLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login-demo', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        await fetch('/api/users/sync', { method: 'POST', credentials: 'include' }).catch(() => {})
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(data.detail || 'Usuario demo no configurado.')
      }
    } catch (err: unknown) {
      const msg = err && typeof (err as Error).message === 'string' ? (err as Error).message : ''
      if (/fetch\s*failed|load\s*failed|failed\s*to\s*fetch|network/i.test(msg)) {
        setError('No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
      } else {
        setError('Error de conexión. Revisa tu red.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await loginViaApi(email, password)
      if (result.ok) {
        // Intentar también iniciar sesión en Supabase (para páginas que aún dependen de sesión Supabase)
        try {
          const { error: sbError } = await supabase.auth.signInWithPassword({ email, password })
          if (sbError) {
            console.warn('Supabase signInWithPassword falló:', sbError.message)
          }
        } catch (sbErr) {
          console.warn('Error intentando login Supabase:', sbErr)
        }

        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.detail || 'Email o contraseña incorrectos')
      }
    } catch (err: unknown) {
      const msg = err && typeof (err as Error).message === 'string' ? (err as Error).message : ''
      if (/fetch\s*failed|load\s*failed|failed\s*to\s*fetch|network/i.test(msg)) {
        setError('No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.')
      } else {
        setError('Error de conexión. Revisa tu red.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sap-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full sap-card p-8 shadow-elevation-2">
        <div className="text-center mb-8">
          <h1 className="text-display font-semibold text-sap-text tracking-tight">Domus Fam</h1>
          <p className="text-body text-sap-text-secondary mt-2">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            <label className="block text-sm font-medium text-sap-text mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sap-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sap-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>

          <div className="relative my-4">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-sap-border" />
            </span>
            <span className="relative flex justify-center text-xs text-sap-text-tertiary">o</span>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleDemoLogin}
            className="w-full sap-button-secondary"
          >
            Entrar como demo (1 clic)
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-sap-text-secondary">
            ¿No tienes una cuenta?{' '}
            <Link href="/register" className="text-sap-primary hover:text-sap-primary-hover font-medium">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

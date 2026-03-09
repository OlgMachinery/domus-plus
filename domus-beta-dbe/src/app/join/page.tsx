'use client'

import { Suspense, useEffect, useState } from 'react'
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

async function getJson(url: string) {
  const res = await fetch(url, { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.detail || data?.message || 'Error')
  return data
}

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')?.trim() || ''

  const [code, setCode] = useState(codeFromUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(!!codeFromUrl)
  const [familyName, setFamilyName] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!codeFromUrl) return
    setValidating(true)
    getJson(`/api/families/invites/validate?code=${encodeURIComponent(codeFromUrl)}`)
      .then((data) => {
        setFamilyName(data.familyName || null)
      })
      .catch(() => setFamilyName(null))
      .finally(() => setValidating(false))
  }, [codeFromUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!code.trim()) {
      setMessage('Ingresa el código de invitación.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setMessage('Email requerido.')
      return
    }
    if (!password || password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    const phoneDigits = (phone || '').replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setMessage('Teléfono requerido (mínimo 10 dígitos).')
      return
    }
    setLoading(true)
    try {
      await postJson('/api/auth/join-family', {
        code: code.trim(),
        email: email.trim().toLowerCase(),
        password,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      })
      setMessage('Listo. Redirigiendo…')
      router.push('/ui')
      router.refresh()
    } catch (err: any) {
      setMessage(err?.message || 'No se pudo unir a la familia.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f1f5f9)' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Unirse a una familia</h1>
        <p style={{ color: 'var(--muted, #64748b)', marginBottom: 24 }}>
          Introduce el código que te compartieron. Si entraste desde un enlace, el código ya está rellenado.
        </p>
        {validating && <p style={{ marginBottom: 16 }}>Comprobando código…</p>}
        {familyName && <p style={{ marginBottom: 16, fontWeight: 600 }}>Te unirás a: {familyName}</p>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label>
            Código de invitación
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej. ABC12XYZ"
              style={{ width: '100%', marginTop: 6 }}
              required
            />
          </label>
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
          <label>
            Contraseña (mín. 6)
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', marginTop: 6 }}
              required
              minLength={6}
            />
          </label>
          <label>
            Nombre (opcional)
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
          <label>
            Teléfono (mín. 10 dígitos)
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 686 123 4567"
              style={{ width: '100%', marginTop: 6 }}
              required
            />
          </label>
          <label>
            Ciudad (opcional)
            <input
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej. Hermosillo"
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
          {message && <p style={{ color: 'var(--danger, #dc2626)', fontSize: 14 }}>{message}</p>}
          <button type="submit" className="btn btnPrimary" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Uniendo…' : 'Unirse a la familia'}
          </button>
        </form>
        <p style={{ marginTop: 24, fontSize: 14 }}>
          <Link href="/ui">← Volver al inicio de sesión</Link>
        </p>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>}>
      <JoinForm />
    </Suspense>
  )
}

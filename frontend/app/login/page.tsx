'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    console.log('🔐 Intentando iniciar sesión con:', email)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Error de autenticación:', error)
        setError(error.message || 'Email o contraseña incorrectos')
      } else if (data?.user && data?.session) {
        console.log('✅ Login exitoso')
        console.log('   Usuario:', data.user.email)
        console.log('   Sesión:', data.session ? 'creada' : 'no creada')
        
        // Esperar un momento para que la sesión se persista
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verificar que la sesión se guardó
        const { data: { session: verifySession } } = await supabase.auth.getSession()
        if (verifySession) {
          console.log('✅ Sesión verificada, redirigiendo...')
          router.push('/dashboard')
          router.refresh()
        } else {
          console.error('⚠️ Sesión no se guardó correctamente')
          setError('Error al guardar la sesión. Intenta de nuevo.')
        }
      } else {
        console.error('❌ No se recibió información del usuario o sesión')
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    } catch (err: any) {
      console.error('❌ Error inesperado:', err)
      setError(err.message || 'Error al iniciar sesión. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DOMUS+</h1>
          <p className="text-gray-500">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            onClick={() => console.log('🖱️ Botón de login clickeado')}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}

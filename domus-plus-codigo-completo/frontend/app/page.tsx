'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/dashboard')
    }
  }, [router])
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            DOMUS<span className="text-primary-600">+</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Sistema de Presupuesto Anual Doméstico
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">Iniciar Sesión</h2>
          
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="tu@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors font-medium"
            >
              Iniciar Sesión
            </button>
          </form>
          
          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="text-primary-600 hover:underline">
                Regístrate
              </Link>
            </p>
            <p className="text-sm text-gray-600">
              O{' '}
              <Link href="/login" className="text-primary-600 hover:underline">
                inicia sesión
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-lg mb-2">Presupuestos por Partida</h3>
            <p className="text-gray-600 text-sm">
              Organiza tus gastos por categorías y subcategorías
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="font-semibold text-lg mb-2">Por Integrante</h3>
            <p className="text-gray-600 text-sm">
              Cada miembro de la familia tiene su propio presupuesto
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl mb-3">📱</div>
            <h3 className="font-semibold text-lg mb-2">WhatsApp Integration</h3>
            <p className="text-gray-600 text-sm">
              Envía recibos por WhatsApp y se procesan automáticamente
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}


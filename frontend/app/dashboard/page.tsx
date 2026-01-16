'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import SAPLayout from '@/components/SAPLayout'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    const init = async () => {
      try {
        console.log('🔍 [DASHBOARD] Verificando sesión...')
        
        // Timeout más agresivo: 3 segundos
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.error('⏱️ [DASHBOARD] Timeout al obtener sesión (3s)')
            setLoading(false)
            router.push('/login')
          }
        }, 3000)

        // Intentar obtener sesión con timeout manual
        const sessionPromise = supabase.auth.getSession()
        
        let sessionResult: any
        try {
          sessionResult = await Promise.race([
            sessionPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout después de 2.5s')), 2500)
            )
          ])
        } catch (timeoutError: any) {
          if (timeoutError.message.includes('Timeout')) {
            console.error('⏱️ [DASHBOARD] Timeout al obtener sesión (2.5s)')
            if (mounted) {
              setLoading(false)
              router.push('/login')
            }
            return
          }
          throw timeoutError
        }

        const { data: { session }, error } = sessionResult
        
        if (timeoutId) clearTimeout(timeoutId)

        if (!mounted) return

        if (error) {
          console.error('❌ [DASHBOARD] Error al obtener sesión:', error)
          setLoading(false)
          router.push('/login')
          return
        }

        if (!session) {
          console.log('⚠️ [DASHBOARD] No hay sesión, redirigiendo a login')
          setLoading(false)
          router.push('/login')
          return
        }

        console.log('✅ [DASHBOARD] Sesión encontrada:', session.user.email)
        if (mounted) {
          setUser(session.user)
          setLoading(false)
        }
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('❌ [DASHBOARD] Error inesperado:', err)
        if (mounted) {
          setLoading(false)
          router.push('/login')
        }
      }
    }
    
    init()
    
    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [router])

  // IMPORTANTE: Siempre renderizar SAPLayout para mantener el mismo número de hooks
  // Esto evita el error "Rendered more hooks than during the previous render"
  return (
    <SAPLayout user={user} title="Dashboard" subtitle="Resumen General">
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-gray-500">Cargando dashboard...</div>
        </div>
      ) : user ? (
        <div className="p-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Bienvenido a DOMUS+</h2>
            <p className="text-gray-600">Has iniciado sesión correctamente como: <strong>{user.email}</strong></p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded border border-blue-100">
                <h3 className="font-semibold text-blue-800">Conexión</h3>
                <p className="text-sm text-blue-600">Activa</p>
              </div>
              <div className="p-4 bg-green-50 rounded border border-green-100">
                <h3 className="font-semibold text-green-800">Base de Datos</h3>
                <p className="text-sm text-green-600">Sincronizada</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SAPLayout>
  )
}

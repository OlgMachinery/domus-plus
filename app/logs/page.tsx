'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import AppLayout from "@/components/AppLayout"

interface ActivityLog {
  id: number
  user_id: number | null
  action_type: string
  entity_type: string
  entity_id: number | null
  description: string
  details: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  user: {
    id: number
    name: string
    email: string
  } | null
}

export const dynamic = 'force-dynamic'

export default function LogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [filters, setFilters] = useState({
    action_type: '',
    entity_type: '',
    days: 30
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    loadUser()
    loadLogs()
  }, [router, filters])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
      router.push('/login')
    }
  }

  const loadLogs = async () => {
    try {
      setLoading(true)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setLogs([])
        setLoading(false)
        return
      }
      
      // Obtener familia del usuario para filtrar logs
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          user:users(id, name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(500)
      
      // Si el usuario tiene familia, filtrar por logs de la familia
      if (userData?.family_id) {
        query = query.eq('family_id', userData.family_id)
      } else {
        // Si no tiene familia, solo mostrar sus propios logs
        query = query.eq('user_id', authUser.id)
      }
      
      // Aplicar filtros
      if (filters.action_type) {
        query = query.eq('action_type', filters.action_type)
      }
      if (filters.entity_type) {
        query = query.eq('entity_type', filters.entity_type)
      }
      if (filters.days) {
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - filters.days)
        query = query.gte('created_at', startDate.toISOString())
      }
      
      const { data: logsData, error } = await query
      
      if (error) {
        console.error('Error cargando logs:', error)
        setLogs([])
        return
      }
      
      setLogs((logsData || []) as ActivityLog[])
    } catch (error: any) {
      console.error('Error cargando logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const actionTypes = Array.from(new Set(logs.map(log => log.action_type))).sort()
  const entityTypes = Array.from(new Set(logs.map(log => log.entity_type))).sort()

  const getActionTypeColor = (actionType: string) => {
    if (actionType.includes('created')) return 'text-sap-success'
    if (actionType.includes('updated')) return 'text-sap-warning'
    if (actionType.includes('deleted')) return 'text-sap-danger'
    return 'text-foreground'
  }

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'budget_created': 'Presupuesto Creado',
      'budget_updated': 'Presupuesto Actualizado',
      'transaction_created': 'Transacción Creada',
      'transaction_updated': 'Transacción Actualizada',
      'user_created': 'Usuario Creado',
      'user_updated': 'Usuario Actualizado'
    }
    return labels[actionType] || actionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const toolbar = (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className="sap-button-secondary"
    >
      {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
    </button>
  )

  return (
    <AppLayout
      user={user}
      title="Log de Actividad"
      subtitle="Registro de todos los movimientos del sistema"
      toolbar={toolbar}
    >
      {/* Filtros */}
      {showFilters && (
        <div className="sap-card p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Tipo de Acción
              </label>
              <select
                value={filters.action_type}
                onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
                className="sap-input"
              >
                <option value="">Todos</option>
                {actionTypes.map(type => (
                  <option key={type} value={type}>{getActionTypeLabel(type)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Tipo de Entidad
              </label>
              <select
                value={filters.entity_type}
                onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
                className="sap-input"
              >
                <option value="">Todos</option>
                {entityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Período (días)
              </label>
              <select
                value={filters.days}
                onChange={(e) => setFilters({ ...filters, days: parseInt(e.target.value) })}
                className="sap-input"
              >
                <option value={7}>Últimos 7 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={90}>Últimos 90 días</option>
                <option value={365}>Último año</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilters({ action_type: '', entity_type: '', days: 30 })}
              className="sap-button-secondary text-sm"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Tabla de logs */}
      {loading ? (
        <div className="sap-card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sap-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-4">Cargando logs...</p>
        </div>
      ) : logs.length > 0 ? (
        <div className="sap-card overflow-hidden">
          <table className="sap-table">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Descripción</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString('es-MX')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleTimeString('es-MX')}
                    </div>
                  </td>
                  <td>
                    {log.user ? (
                      <div>
                        <div className="text-sm font-medium text-foreground">{log.user.name}</div>
                        <div className="text-xs text-muted-foreground">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sistema</span>
                    )}
                  </td>
                  <td>
                    <span className={`text-xs font-medium ${getActionTypeColor(log.action_type)}`}>
                      {getActionTypeLabel(log.action_type)}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-muted-foreground">{log.entity_type}</span>
                  </td>
                  <td>
                    <div className="text-sm text-foreground max-w-md">
                      {log.description}
                    </div>
                  </td>
                  <td>
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary hover:underline">
                          Ver detalles
                        </summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-w-xs">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sap-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay logs de actividad para el período seleccionado
          </p>
        </div>
      )}
    </AppLayout>
  )
}

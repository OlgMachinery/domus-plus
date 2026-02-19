import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que sea administrador
    const { data: userData } = await supabase
      .from('users')
      .select('is_family_admin, family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo los administradores pueden ver estadísticas' },
        { status: 403 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateISO = startDate.toISOString()

    // Obtener logs de la familia
    const { data: familyUsers } = await supabase
      .from('users')
      .select('id')
      .eq('family_id', userData.family_id)

    const familyUserIds = familyUsers?.map(u => u.id) || []

    // Total de logs
    const { count: totalLogs } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .in('user_id', familyUserIds)
      .gte('created_at', startDateISO)

    // Logs por tipo de acción (usando función SQL o múltiples queries)
    const { data: allLogs } = await supabase
      .from('activity_logs')
      .select('action_type, entity_type, user_id')
      .in('user_id', familyUserIds)
      .gte('created_at', startDateISO)

    // Procesar estadísticas
    const byActionType: Record<string, number> = {}
    const byEntityType: Record<string, number> = {}
    const byUser: Record<string, number> = {}

    if (allLogs) {
      allLogs.forEach((log: any) => {
        // Por tipo de acción
        if (log.action_type) {
          byActionType[log.action_type] = (byActionType[log.action_type] || 0) + 1
        }
        // Por tipo de entidad
        if (log.entity_type) {
          byEntityType[log.entity_type] = (byEntityType[log.entity_type] || 0) + 1
        }
        // Por usuario
        if (log.user_id) {
          byUser[log.user_id] = (byUser[log.user_id] || 0) + 1
        }
      })
    }

    return NextResponse.json({
      total_logs: totalLogs || 0,
      period_days: days,
      by_action_type: byActionType,
      by_entity_type: byEntityType,
      by_user: byUser,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/activity-logs/stats:', error)
    return NextResponse.json(
      { detail: `Error al obtener estadísticas: ${error.message}` },
      { status: 500 }
    )
  }
}

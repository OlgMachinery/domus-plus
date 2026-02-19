import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener usuario para verificar si es admin
    const { data: userData } = await supabase
      .from('users')
      .select('is_family_admin, family_id')
      .eq('id', authUser.id)
      .single()

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const skip = parseInt(searchParams.get('skip') || '0')
    const limit = parseInt(searchParams.get('limit') || '100')
    const actionType = searchParams.get('action_type')
    const entityType = searchParams.get('entity_type')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Construir query
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        user:users(id, name, email)
      `)
      .order('created_at', { ascending: false })

    // Filtros según permisos
    if (!userData?.is_family_admin) {
      // Usuarios normales solo ven sus propios logs
      query = query.eq('user_id', authUser.id)
    } else if (userId) {
      // Admin puede filtrar por usuario
      query = query.eq('user_id', userId)
    } else if (userData?.family_id) {
      // Admin ve logs de su familia
      const { data: familyUsers } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', userData.family_id)

      if (familyUsers && familyUsers.length > 0) {
        const familyUserIds = familyUsers.map(u => u.id)
        query = query.in('user_id', familyUserIds)
      }
    }

    // Aplicar filtros adicionales
    if (actionType) {
      query = query.eq('action_type', actionType)
    }
    if (entityType) {
      query = query.eq('entity_type', entityType)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Paginación
    query = query.range(skip, skip + limit - 1)

    const { data: logs, error } = await query

    if (error) {
      console.error('Error obteniendo logs:', error)
      return NextResponse.json(
        { detail: `Error al obtener logs: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(logs || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/activity-logs:', error)
    return NextResponse.json(
      { detail: `Error al obtener logs: ${error.message}` },
      { status: 500 }
    )
  }
}

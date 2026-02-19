import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseExcelBudgets } from '@/lib/services/excel-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación (múltiples métodos)
    let authUser = null
    
    // Método 1: Token en header Authorization
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      const { data: { user }, error: tokenError } = await supabase.auth.getUser(accessToken)
      if (user && !tokenError) {
        authUser = user
      }
    }
    
    // Método 2: Cookies (fallback)
    if (!authUser) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user && !userError) {
        authUser = user
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (session?.user && !sessionError) {
          authUser = session.user
        }
      }
    }
    
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
      )
    }

    // Obtener usuario completo
    let { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin, name, email')
      .eq('id', authUser.id)
      .single()

    if (!userData) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado en la tabla users. Sincroniza el usuario o vuelve a registrarte.' },
        { status: 404 }
      )
    }

    // Si el usuario no tiene familia, crear una automáticamente usando función SQL
    if (!userData?.family_id) {
      console.log('Usuario sin familia, creando familia automáticamente...')
      
      // Usar función SQL para evitar recursión RLS
      const { data: familyResult, error: familyError } = await supabase
        .rpc('create_family_for_user', {
          p_user_id: authUser.id,
          p_family_name: `Familia de ${userData?.name || userData?.email?.split('@')[0] || 'Usuario'}`
        })

      if (familyError || !familyResult || familyResult.length === 0) {
        console.error('Error creando familia:', familyError)
        return NextResponse.json(
          { detail: `Error al crear familia: ${familyError?.message || 'Error desconocido'}. Ejecuta el script supabase/funcion-crear-familia-auto.sql en Supabase SQL Editor.` },
          { status: 500 }
        )
      }

      const result = familyResult[0]
      if (!result.success) {
        console.error('Error en función:', result.message)
        return NextResponse.json(
          { detail: result.message || 'Error al crear familia' },
          { status: 500 }
        )
      }

      // Recargar datos del usuario
      const { data: updatedUser } = await supabase
        .from('users')
        .select('family_id, is_family_admin, name, email')
        .eq('id', authUser.id)
        .single()

      if (updatedUser) {
        userData = updatedUser
        console.log('Familia creada y asignada exitosamente:', result.family_id)
      }
    }

    if (!userData.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador de la familia puede hacer setup desde Excel' },
        { status: 403 }
      )
    }

    // Obtener archivo
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { detail: 'No se proporcionó un archivo' },
        { status: 400 }
      )
    }

    // Validar extensión
    const validExtensions = ['.xlsx', '.xlsm', '.xls']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { detail: 'El archivo debe ser Excel (.xlsx, .xlsm, .xls)' },
        { status: 400 }
      )
    }

    // Leer el archivo
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { detail: 'El archivo está vacío' },
        { status: 400 }
      )
    }

    // Parsear presupuestos
    let excelBudgets
    try {
      excelBudgets = parseExcelBudgets(buffer, 'Input Categories Budget')
    } catch (parseError: any) {
      return NextResponse.json(
        { detail: `Error al parsear presupuestos: ${parseError.message}` },
        { status: 400 }
      )
    }

    if (!excelBudgets || excelBudgets.length === 0) {
      return NextResponse.json(
        { detail: 'No se encontraron presupuestos en el Excel' },
        { status: 400 }
      )
    }

    const year = new Date().getFullYear()

    // Limpiar datos existentes de la familia (opcional, comentado por seguridad)
    // Descomentar si quieres que el setup limpie todo antes de importar
    /*
    const { data: existingBudgets } = await supabase
      .from('family_budgets')
      .select('id')
      .eq('family_id', userData.family_id)

    if (existingBudgets && existingBudgets.length > 0) {
      const existingIds = existingBudgets.map(b => b.id)
      await supabase.from('user_budgets').delete().in('family_budget_id', existingIds)
      await supabase.from('family_budgets').delete().in('id', existingIds)
    }
    */

    // Crear presupuestos
    const createdBudgets = []
    const errors = []

    for (const budget of excelBudgets) {
      try {
        const category = budget.category.toUpperCase().replace(/\s+/g, '_')
        const subcategory = budget.subcategory.toUpperCase().replace(/\s+/g, '_')

        const { data: newBudget, error: budgetError } = await supabase
          .from('family_budgets')
          .insert({
            family_id: userData.family_id,
            category: category,
            subcategory: subcategory,
            year: year,
            total_amount: budget.total_amount,
            monthly_amounts: budget.monthly_amounts,
            budget_type: 'shared',
            distribution_method: 'equal',
            auto_distribute: true,
          })
          .select()
          .single()

        if (budgetError) {
          errors.push(`Error: ${budget.category} - ${budget.subcategory}: ${budgetError.message}`)
          continue
        }

        // Distribuir entre miembros
        const { data: familyMembers } = await supabase
          .from('users')
          .select('id')
          .eq('family_id', userData.family_id)
          .eq('is_active', true)

        if (familyMembers && familyMembers.length > 0) {
          const amountPerUser = budget.total_amount / familyMembers.length
          const userBudgets = familyMembers.map((member: any) => ({
            user_id: member.id,
            family_budget_id: newBudget.id,
            allocated_amount: Math.round(amountPerUser * 100) / 100,
          }))

          await supabase
            .from('user_budgets')
            .insert(userBudgets)
        }

        createdBudgets.push(newBudget)
      } catch (error: any) {
        errors.push(`Error: ${budget.category} - ${budget.subcategory}: ${error.message}`)
      }
    }

    // Crear log
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'setup_from_excel',
        entity_type: 'budget',
        description: `Setup completo desde Excel: ${createdBudgets.length} presupuestos creados`,
        details: {
          year,
          count: createdBudgets.length,
          errors: errors.length,
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json({
      message: `Setup completado: ${createdBudgets.length} presupuestos creados`,
      created: createdBudgets.length,
      errors: errors.length,
      error_details: errors,
      budgets: createdBudgets,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/excel-import/setup-from-excel:', error)
    return NextResponse.json(
      { detail: `Error al hacer setup desde Excel: ${error.message}` },
      { status: 500 }
    )
  }
}

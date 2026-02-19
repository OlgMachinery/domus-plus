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

    // Obtener usuario completo (con manejo de errores mejorado)
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('family_id, is_family_admin, name, email')
      .eq('id', authUser.id)
      .single()

    if (userError) {
      console.error('Error obteniendo usuario:', userError)
      return NextResponse.json(
        { 
          detail: `Error al obtener información del usuario: ${userError.message}`,
          debug: 'Verifica las políticas RLS de la tabla users. El usuario debe poder leer sus propios datos.'
        },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { 
          detail: 'No se encontró información del usuario en la base de datos',
          debug: 'El usuario autenticado no existe en la tabla users. Verifica que el usuario esté registrado correctamente.'
        },
        { status: 404 }
      )
    }

    // Si el usuario no tiene familia, crear una automáticamente usando el nuevo flujo paso a paso
    if (!userData?.family_id) {
      console.log('Usuario sin familia, creando familia automáticamente (paso a paso)...')
      
      const familyName = `Familia de ${userData?.name || userData?.email?.split('@')[0] || 'Usuario'}`
      
      // PASO 1: Crear la familia
      console.log('Paso 1: Creando familia...')
      const { data: createFamilyResult, error: createFamilyError } = await supabase
        .rpc('create_family', {
          p_family_name: familyName,
          p_admin_user_id: authUser.id
        })
      
      if (createFamilyError || !createFamilyResult || createFamilyResult.length === 0) {
        console.error('Error creando familia (Paso 1):', createFamilyError)
        // Fallback a función de compatibilidad si create_family no existe
        console.log('Intentando con función de compatibilidad create_family_for_user...')
        const { data: fallbackResult, error: fallbackError } = await supabase
          .rpc('create_family_for_user', {
            p_user_id: authUser.id,
            p_family_name: familyName
          })
        
        if (fallbackError || !fallbackResult) {
          return NextResponse.json(
            { 
              detail: `Error al crear familia: ${fallbackError?.message || createFamilyError?.message || 'Error desconocido'}`,
              debug: 'Ejecuta el script supabase/flujo-crear-familia-completo.sql en Supabase SQL Editor para crear las funciones necesarias.'
            },
            { status: 500 }
          )
        }
        
        // Procesar resultado de fallback
        const result = Array.isArray(fallbackResult) ? fallbackResult[0] : fallbackResult
        if (result && result.success && result.family_id) {
          userData = { ...userData, family_id: result.family_id, is_family_admin: true }
          console.log('✅ Familia creada usando función de compatibilidad. ID:', result.family_id)
        } else {
          return NextResponse.json(
            { 
              detail: result?.message || 'Error al crear familia',
              debug: 'La función create_family_for_user no retornó un resultado exitoso.'
            },
            { status: 500 }
          )
        }
      } else {
        // Procesar resultado del nuevo flujo
        const familyResult = Array.isArray(createFamilyResult) ? createFamilyResult[0] : createFamilyResult
        
        if (!familyResult.success || !familyResult.family_id) {
          console.error('Error: Familia no se creó correctamente:', familyResult)
          return NextResponse.json(
            { 
              detail: familyResult.message || 'Error al crear familia',
              debug: 'La función create_family no retornó un resultado exitoso.'
            },
            { status: 500 }
          )
        }
        
        const newFamilyId = familyResult.family_id
        console.log('✅ Paso 1 completado: Familia creada con ID:', newFamilyId)
        
        // PASO 2: Asignar usuario como administrador
        console.log('Paso 2: Asignando usuario como administrador...')
        const { data: assignAdminResult, error: assignAdminError } = await supabase
          .rpc('assign_family_admin', {
            p_user_id: authUser.id,
            p_family_id: newFamilyId
          })
        
        if (assignAdminError || !assignAdminResult || assignAdminResult.length === 0) {
          console.error('Error asignando admin (Paso 2):', assignAdminError)
          // Intentar eliminar la familia creada si falla la asignación
          await supabase.from('families').delete().eq('id', newFamilyId)
          return NextResponse.json(
            { 
              detail: `Error al asignar administrador: ${assignAdminError?.message || 'Error desconocido'}`,
              debug: 'La familia se creó pero falló al asignar el administrador. La familia fue eliminada.'
            },
            { status: 500 }
          )
        }
        
        const assignResult = Array.isArray(assignAdminResult) ? assignAdminResult[0] : assignAdminResult
        
        if (!assignResult.success) {
          console.error('Error: No se pudo asignar admin:', assignResult)
          // Intentar eliminar la familia creada
          await supabase.from('families').delete().eq('id', newFamilyId)
          return NextResponse.json(
            { 
              detail: assignResult.message || 'Error al asignar administrador',
              debug: 'La familia se creó pero falló al asignar el administrador. La familia fue eliminada.'
            },
            { status: 500 }
          )
        }
        
        console.log('✅ Paso 2 completado: Usuario asignado como administrador')
        
        // Recargar datos del usuario para obtener la familia asignada
        console.log('Recargando datos del usuario...')
        let retries = 3
        let updatedUser = null
        
        while (retries > 0 && !updatedUser) {
          const { data, error } = await supabase
            .from('users')
            .select('family_id, is_family_admin, name, email')
            .eq('id', authUser.id)
            .single()
          
          if (error) {
            console.error(`Error recargando usuario (intento ${4 - retries}):`, error)
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
          } else if (data && data.family_id) {
            updatedUser = data
            break
          } else {
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
          }
        }
        
        if (updatedUser && updatedUser.family_id) {
          userData = updatedUser
          console.log('✅ Usuario recargado exitosamente. Familia ID:', updatedUser.family_id)
        } else {
          // Si no se puede recargar pero tenemos el family_id, usarlo
          userData = { ...userData, family_id: newFamilyId, is_family_admin: true }
          console.log('⚠️ No se pudo recargar usuario, usando family_id del resultado:', newFamilyId)
        }
      }
    }

    // Validar permisos del usuario
    if (!userData.family_id) {
      return NextResponse.json(
        { 
          detail: 'El usuario no tiene una familia asignada. Por favor, contacta al administrador o ejecuta el script de creación de familia.',
          debug: 'El usuario necesita tener un family_id asignado para poder crear presupuestos.'
        },
        { status: 403 }
      )
    }

    if (!userData.is_family_admin) {
      return NextResponse.json(
        { 
          detail: 'Solo el administrador de la familia puede importar presupuestos',
          debug: `El usuario tiene family_id=${userData.family_id} pero is_family_admin=false. Necesita ser administrador para crear presupuestos.`
        },
        { status: 403 }
      )
    }

    console.log('✅ Usuario validado:', {
      user_id: authUser.id,
      family_id: userData.family_id,
      is_family_admin: userData.is_family_admin,
      can_import: true
    })

    // Obtener parámetros
    // Puede venir como FormData (archivo) o como JSON (presupuestos seleccionados)
    const contentType = request.headers.get('content-type') || ''
    
    let excelBudgets: any[] = []
    let year = new Date().getFullYear()
    
    if (contentType.includes('application/json')) {
      // Recibir presupuestos seleccionados como JSON
      const body = await request.json()
      excelBudgets = body.budgets || []
      year = body.year || new Date().getFullYear()
      
      if (!excelBudgets || excelBudgets.length === 0) {
        return NextResponse.json(
          { detail: 'No se proporcionaron presupuestos para importar' },
          { status: 400 }
        )
      }
    } else {
      // FormData: parsear el archivo (compatibilidad con código anterior)
      const formData = await request.formData()
      const file = formData.get('file') as File
      const yearParam = formData.get('year') as string | null
      year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

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

      // Parsear presupuestos del Excel
      try {
        excelBudgets = parseExcelBudgets(buffer, 'Input Categories Budget')
      } catch (parseError: any) {
        return NextResponse.json(
          { detail: `Error al parsear presupuestos del Excel: ${parseError.message}` },
          { status: 400 }
        )
      }

      if (!excelBudgets || excelBudgets.length === 0) {
        return NextResponse.json(
          { detail: 'No se encontraron presupuestos en el Excel. Verifica que la hoja "Input Categories Budget" tenga datos de presupuestos.' },
          { status: 400 }
        )
      }
    }

    // Eliminar presupuestos existentes del año
    const { data: existingBudgets } = await supabase
      .from('family_budgets')
      .select('id')
      .eq('family_id', userData.family_id)
      .eq('year', year)

    if (existingBudgets && existingBudgets.length > 0) {
      const existingIds = existingBudgets.map(b => b.id)
      
      // Eliminar user_budgets asociados
      await supabase
        .from('user_budgets')
        .delete()
        .in('family_budget_id', existingIds)
      
      // Eliminar presupuestos
      await supabase
        .from('family_budgets')
        .delete()
        .in('id', existingIds)
    }

    // Crear nuevos presupuestos
    const createdBudgets = []
    const errors = []

    console.log(`Procesando ${excelBudgets.length} presupuestos del Excel para el año ${year}`)

    for (const budget of excelBudgets) {
      try {
        // Mapear categoría y subcategoría a enums del sistema
        // Esto depende de cómo estén en el Excel vs cómo están en el sistema
        const category = budget.category.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
        const subcategory = budget.subcategory.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
        
        console.log(`Procesando presupuesto: ${budget.category} -> ${category}, ${budget.subcategory} -> ${subcategory}`)

        // Crear presupuesto
        const budgetData = {
          family_id: userData.family_id,
          category: category,
          subcategory: subcategory,
          year: year,
          total_amount: budget.total_amount,
          monthly_amounts: budget.monthly_amounts,
          budget_type: 'shared',
          distribution_method: 'equal',
          auto_distribute: true,
        }
        
        console.log('Insertando presupuesto con datos:', budgetData)
        
        const { data: newBudget, error: budgetError } = await supabase
          .from('family_budgets')
          .insert(budgetData)
          .select()
          .single()

        if (budgetError) {
          const errorMsg = `Error creando presupuesto ${budget.category} - ${budget.subcategory}: ${budgetError.message}`
          console.error('Error insertando presupuesto:', {
            category,
            subcategory,
            family_id: userData.family_id,
            year,
            error: budgetError,
            errorCode: budgetError.code,
            errorDetails: budgetError.details,
            errorHint: budgetError.hint,
            originalCategory: budget.category,
            originalSubcategory: budget.subcategory,
            userIsAdmin: userData.is_family_admin,
          })
          
          // Agregar información adicional si es un error de permisos
          let detailedError = errorMsg
          if (budgetError.code === '42501' || budgetError.message?.includes('permission') || budgetError.message?.includes('policy')) {
            detailedError += ` (Error de permisos RLS. Verifica que el usuario sea administrador de familia y que las políticas RLS estén correctamente configuradas)`
          }
          
          errors.push(detailedError)
          continue
        }

        // Distribuir automáticamente entre miembros de la familia
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
        errors.push(`Error procesando presupuesto ${budget.category} - ${budget.subcategory}: ${error.message}`)
      }
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budgets_imported',
        entity_type: 'budget',
        description: `Importados ${createdBudgets.length} presupuestos desde Excel para el año ${year}`,
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
      message: `Importados ${createdBudgets.length} presupuestos exitosamente`,
      created: createdBudgets.length,
      errors: errors.length,
      error_details: errors,
      budgets: createdBudgets,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/excel-import/import-budgets:', error)
    return NextResponse.json(
      { detail: `Error al importar presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}

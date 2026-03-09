import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * API Route para procesar recibos con OCR usando OpenAI
 * 
 * Flujo:
 * 1. Autenticar usuario (token header o cookies)
 * 2. Asegurar que el usuario existe en la tabla users (usar función SQL si es necesario)
 * 3. Procesar imágenes con OpenAI
 * 4. Guardar recibo y items en Supabase
 * 5. Retornar recibo completo con items
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('📥 [RECEIPT PROCESS] Iniciando procesamiento de recibo')
  
  try {
    // ============================================
    // PASO 1: AUTENTICACIÓN
    // ============================================
    const supabase = await createClient()
    let authUser = null
    
    // Método 1: Token en header Authorization
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      console.log('🔑 [AUTH] Verificando token en header...')
      const { data: { user }, error: tokenError } = await supabase.auth.getUser(accessToken)
      if (user && !tokenError) {
        authUser = user
        console.log('✅ [AUTH] Usuario autenticado vía token:', authUser.id)
      }
    }
    
    // Método 2: Cookies (fallback)
    if (!authUser) {
      console.log('🔍 [AUTH] Verificando cookies...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user && !userError) {
        authUser = user
        console.log('✅ [AUTH] Usuario autenticado vía cookies:', authUser.id)
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (session?.user && !sessionError) {
          authUser = session.user
          console.log('✅ [AUTH] Usuario autenticado vía sesión:', authUser.id)
        }
      }
    }
    
    if (!authUser) {
      console.error('❌ [AUTH] No se pudo autenticar el usuario')
      return NextResponse.json(
        { detail: 'No autenticado. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
      )
    }

    // ============================================
    // PASO 2: ASEGURAR QUE EL USUARIO EXISTE EN LA TABLA users
    // ============================================
    console.log('👤 [USER] Verificando usuario en tabla users...')
    let userData: any = null
    
    // Función helper para obtener usuario con retry exponencial
    const getUserWithRetry = async (maxRetries = 5, delay = 200): Promise<any> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (!error && data && data.id) {
          return data
        }
        
        if (attempt < maxRetries) {
          const waitTime = delay * attempt // Backoff exponencial
          console.log(`⏳ [USER] Intento ${attempt}/${maxRetries} falló, esperando ${waitTime}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
      return null
    }
    
    // Intentar obtener el usuario
    userData = await getUserWithRetry(3, 300)
    
    // Si no existe, crearlo
    if (!userData) {
      console.warn('⚠️ [USER] Usuario no encontrado, creando...')
      
      // Método 1: Función SQL (más confiable)
      let creationAttempted = false
      try {
        console.log('🔧 [USER] Intentando función SQL ensure_user_exists...')
        const { error: sqlError } = await supabase.rpc('ensure_user_exists', {
          p_user_id: authUser.id,
          p_email: authUser.email || '',
          p_name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
          p_phone: authUser.user_metadata?.phone || null
        })
        
        if (!sqlError) {
          creationAttempted = true
          console.log('✅ [USER] Función SQL ejecutada')
        } else {
          console.warn('⚠️ [USER] Función SQL falló:', sqlError.message)
        }
      } catch (err: any) {
        console.warn('⚠️ [USER] Función SQL no disponible:', err.message)
      }
      
      // Método 2: Insert directo (fallback)
      if (!creationAttempted) {
        try {
          console.log('🔧 [USER] Intentando insert directo...')
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
              phone: authUser.user_metadata?.phone || null,
              is_active: true,
              is_family_admin: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          
          if (!insertError) {
            creationAttempted = true
            console.log('✅ [USER] Insert directo ejecutado')
          } else {
            console.error('❌ [USER] Insert directo falló:', insertError.message)
          }
        } catch (err: any) {
          console.error('❌ [USER] Error en insert:', err.message)
        }
      }
      
      // Si se intentó crear, obtener el usuario con más reintentos
      if (creationAttempted) {
        console.log('🔍 [USER] Obteniendo usuario después de creación...')
        // Esperar un momento para que la transacción se complete
        await new Promise(resolve => setTimeout(resolve, 300))
        userData = await getUserWithRetry(5, 400) // Más intentos después de crear
      }
      
      // Si aún no se puede obtener, dar error con instrucciones
      if (!userData) {
        console.error('❌ [USER] No se pudo crear u obtener el usuario después de todos los intentos')
        return NextResponse.json(
          { 
            detail: 'Usuario no encontrado en la base de datos. Ejecuta el SQL en supabase/crear-usuario-automatico.sql',
            instructions: [
              '1. Ve a https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new',
              '2. Abre el archivo supabase/crear-usuario-automatico.sql',
              '3. Copia y pega TODO el contenido',
              '4. Ejecuta el SQL (Run)',
              '5. Recarga esta página e intenta de nuevo'
            ],
            error: 'No se pudo crear u obtener el usuario'
          },
          { status: 500 }
        )
      }
    }
    
    // Validación final
    if (!userData || !userData.id || !userData.email) {
      console.error('❌ [USER] Datos de usuario inválidos:', userData)
      return NextResponse.json(
        { detail: 'Error al obtener datos del usuario. Los datos están incompletos.' },
        { status: 500 }
      )
    }
    
    console.log('✅ [USER] Usuario verificado:', userData.email, `(ID: ${userData.id})`)

    // ============================================
    // PASO 3: PARSEAR FORM DATA
    // ============================================
    console.log('📋 [FORM] Parseando FormData...')
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const targetUserId = formData.get('target_user_id')?.toString()

    if (!files || files.length === 0) {
      return NextResponse.json(
        { detail: 'Debes subir al menos un archivo' },
        { status: 400 }
      )
    }

    console.log(`📁 [FILES] ${files.length} archivo(s) recibido(s)`)
    
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const admin = serviceKey ? createAdminClient() : null

    // Determinar usuario asignado (por seguridad)
    let assignedUserId = authUser.id
    if (targetUserId && targetUserId !== authUser.id) {
      if (!admin) {
        return NextResponse.json(
          { detail: 'No se puede asignar a otro usuario: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' },
          { status: 400 }
        )
      }
      if (!userData?.is_family_admin) {
        return NextResponse.json({ detail: 'Solo un admin de familia puede asignar recibos a otros usuarios.' }, { status: 403 })
      }
      const { data: targetRow, error: targetErr } = await admin.from('users').select('id, family_id').eq('id', targetUserId).single()
      if (targetErr || !targetRow?.id) {
        return NextResponse.json({ detail: 'Usuario destino no encontrado.' }, { status: 404 })
      }
      if (!userData?.family_id || targetRow.family_id !== userData.family_id) {
        return NextResponse.json({ detail: 'El usuario destino no pertenece a tu familia.' }, { status: 403 })
      }
      assignedUserId = targetUserId
    }

    if (!userData?.family_id) {
      return NextResponse.json({ detail: 'No tienes familia asignada. Completa el setup primero.' }, { status: 409 })
    }

    // ============================================
    // PASO 4: PROCESAR IMÁGENES CON OPENAI
    // ============================================
    console.log('🤖 [OPENAI] Iniciando procesamiento con IA...')
    
    // Verificar OpenAI API Key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          detail: 'OPENAI_API_KEY no está configurada. Configura esta variable en .env.local para usar el procesamiento de recibos con OCR.'
        },
        { status: 500 }
      )
    }

    // Verificar OpenAI API Key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          detail: 'OPENAI_API_KEY no está configurada. Configura esta variable en .env.local para usar el procesamiento de recibos con OCR.'
        },
        { status: 500 }
      )
    }

    // Procesar cada archivo
    const combinedItems: any[] = []
    const receiptRaws: any[] = []
    let firstDate: string | null = null
    let firstTime: string | null = null
    let firstCurrency: string | null = null
    let firstMerchant: string | null = null
    let firstAmountRaw: string | null = null
    let firstCategory: string | null = null
    let firstSubcategory: string | null = null
    let firstConcept: string | null = null
    let firstReference: string | null = null
    let firstOperationId: string | null = null
    let firstTrackingKey: string | null = null
    const partsStatus: any[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`🖼️ [IMAGE ${i + 1}/${files.length}] Procesando: ${file.name}`)
      
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { detail: `El archivo ${file.name} debe ser una imagen` },
          { status: 400 }
        )
      }

      // Convertir a base64
      const imageBytes = await file.arrayBuffer()
      const imageBuffer = Buffer.from(imageBytes)
      const imageBase64 = imageBuffer.toString('base64')
      
      // Detectar formato
      let imageFormat = 'jpeg'
      if (file.type.includes('png')) imageFormat = 'png'
      else if (file.type.includes('gif')) imageFormat = 'gif'
      else if (file.type.includes('webp')) imageFormat = 'webp'

      // Procesar con OpenAI usando el servicio
      try {
        const { processReceiptImage } = await import('@/lib/services/receipt-processor')
        const receiptRaw = await processReceiptImage(imageBase64, imageFormat)
        
        if (!receiptRaw || !receiptRaw.items || receiptRaw.items.length === 0) {
          console.warn(`⚠️ [IMAGE ${i + 1}] No se encontraron items en el recibo`)
          partsStatus.push({ part: i + 1, ok: false, items: 0, filename: file.name })
          continue
        }

        console.log(`✅ [IMAGE ${i + 1}] Procesado exitosamente: ${receiptRaw.items.length} items`)
        partsStatus.push({ part: i + 1, ok: true, items: receiptRaw.items.length, filename: file.name })
        receiptRaws.push(receiptRaw)

        // Acumular datos del primer recibo válido
        if (!firstDate && receiptRaw.date) firstDate = receiptRaw.date
        if (!firstTime && receiptRaw.time) firstTime = receiptRaw.time
        if (!firstCurrency && receiptRaw.currency) firstCurrency = receiptRaw.currency
        if (!firstMerchant && receiptRaw.merchant_or_beneficiary) firstMerchant = receiptRaw.merchant_or_beneficiary
        if (!firstAmountRaw && receiptRaw.amount_raw) firstAmountRaw = receiptRaw.amount_raw
        if (!firstCategory && receiptRaw.category) firstCategory = receiptRaw.category
        if (!firstSubcategory && receiptRaw.subcategory) firstSubcategory = receiptRaw.subcategory
        if (!firstConcept && receiptRaw.concept) firstConcept = receiptRaw.concept
        if (!firstReference && receiptRaw.reference) firstReference = receiptRaw.reference
        if (!firstOperationId && receiptRaw.operation_id) firstOperationId = receiptRaw.operation_id
        if (!firstTrackingKey && receiptRaw.tracking_key) firstTrackingKey = receiptRaw.tracking_key

        // Agregar items
        const items = receiptRaw.items || []
        for (const item of items) {
          combinedItems.push({
            raw_line: item.raw_line || item.description || '',
            quantity_raw: item.quantity_raw || item.quantity?.toString() || '',
            unit_price_raw: item.unit_price_raw || item.unit_price?.toString() || '',
            total_raw: item.total_raw || item.total?.toString() || ''
          })
        }
      } catch (error: any) {
        console.error(`❌ [IMAGE ${i + 1}] Error procesando:`, error.message)
        partsStatus.push({ part: i + 1, ok: false, items: 0, error: error.message, filename: file.name })
        // Continuar con el siguiente archivo
      }
    }

    // Validar que se procesó al menos un archivo
    if (combinedItems.length === 0) {
      return NextResponse.json(
        { 
          detail: 'No se pudieron extraer datos de ninguna imagen. Verifica que las imágenes sean recibos válidos.',
          parts_status: partsStatus
        },
        { status: 400 }
      )
    }

    // ============================================
    // PASO 5: GUARDAR EN BASE DE DATOS
    // ============================================
    console.log('💾 [DB] Guardando recibo en Supabase...')
    console.log(`   Items extraídos: ${combinedItems.length}`)
    
    // Calcular monto total
    const declaredTotal = parseFloatSafe(firstAmountRaw || '0')
    const sumItems = combinedItems.reduce((sum, it) => sum + parseFloatSafe(it.total_raw || '0'), 0)
    const chosenAmount = declaredTotal > 0 ? declaredTotal : sumItems
    
    console.log(`   Monto declarado: ${declaredTotal}`)
    console.log(`   Monto sumado de items: ${sumItems}`)
    console.log(`   Monto elegido: ${chosenAmount}`)

    const inferred = inferReceiptCategory({
      merchant: firstMerchant,
      items: combinedItems,
      aiCategory: firstCategory,
      aiSubcategory: firstSubcategory,
    })

    // Crear recibo en Supabase
    console.log('💾 [DB] Insertando recibo en base de datos...')
    console.log(`   User ID: ${assignedUserId}`)
    console.log(`   Monto: ${chosenAmount} ${firstCurrency || 'MXN'}`)
    console.log(`   Items: ${combinedItems.length}`)
    
    const db = admin || supabase
    const { data: receiptData, error: receiptError } = await db
      .from('receipts')
      .insert({
        user_id: assignedUserId,
        date: firstDate,
        time: firstTime,
        amount: chosenAmount,
        currency: firstCurrency || 'MXN',
        merchant_or_beneficiary: firstMerchant,
        category: inferred.category || firstCategory,
        subcategory: inferred.subcategory || firstSubcategory,
        concept: firstConcept,
        reference: firstReference,
        operation_id: firstOperationId,
        tracking_key: firstTrackingKey,
        status: 'pending',
        notes: JSON.stringify({ 
          raw_receipts: receiptRaws,
          processing_metadata: {
            files_processed: files.length,
            items_extracted: combinedItems.length,
            processing_time_ms: Date.now() - startTime
          }
        }),
      })
      .select()
      .single()

    if (receiptError) {
      console.error('❌ [DB] Error al crear recibo:', receiptError)
      console.error('   Error code:', receiptError.code)
      console.error('   Error message:', receiptError.message)
      console.error('   Error details:', receiptError.details)
      console.error('   Error hint:', receiptError.hint)
      
      // Si es error de RLS, dar instrucciones específicas
      if (receiptError.code === '42501' || receiptError.message?.includes('row-level security')) {
        return NextResponse.json(
          { 
            detail: 'Error de permisos al guardar recibo. Ejecuta el SQL en supabase/politicas-rls-receipts.sql',
            instructions: [
              '1. Ve a https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new',
              '2. Abre el archivo supabase/politicas-rls-receipts.sql',
              '3. Copia y pega TODO el contenido',
              '4. Ejecuta el SQL (Run)',
              '5. Intenta subir el recibo de nuevo'
            ],
            error: 'RLS policy prevents receipt creation',
            errorCode: receiptError.code
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { 
          detail: `Error al guardar recibo en la base de datos: ${receiptError.message}`,
          error: receiptError.message,
          errorCode: receiptError.code,
          hint: receiptError.hint
        },
        { status: 500 }
      )
    }

    console.log(`✅ [DB] Recibo creado con ID: ${receiptData.id}`)

    // Crear items del recibo
    if (receiptData && combinedItems.length > 0) {
      console.log(`📦 [DB] Guardando ${combinedItems.length} items...`)
      
      const receiptItems = combinedItems.map((item, idx) => ({
        receipt_id: receiptData.id,
        description: item.raw_line || `Item ${idx + 1}`,
        amount: parseFloatSafe(item.total_raw || '0'),
        quantity: item.quantity_raw ? parseFloatSafe(item.quantity_raw) : null,
        unit_price: item.unit_price_raw ? parseFloatSafe(item.unit_price_raw) : null,
        notes: `line_number: ${idx + 1}`,
      }))

      const { error: itemsError } = await db
        .from('receipt_items')
        .insert(receiptItems)

      if (itemsError) {
        console.error('❌ [DB] Error al crear items:', itemsError)
        console.error('   Error code:', itemsError.code)
        console.error('   Error message:', itemsError.message)
        
        // Si es error de RLS, loggear pero no fallar completamente
        if (itemsError.code === '42501' || itemsError.message?.includes('row-level security')) {
          console.error('⚠️ [DB] Error de RLS en items. Ejecuta supabase/politicas-rls-receipts.sql')
        }
        // No fallar completamente, el recibo ya se creó
      } else {
        console.log(`✅ [DB] ${receiptItems.length} items guardados exitosamente`)
      }
    }

    // ============================================
    // PASO 6: CREAR TRANSACCIÓN (GASTO) AUTOMÁTICAMENTE
    // ============================================
    let createdTransaction: any = null
    let suggestedBudget: any = null
    try {
      if (admin) {
        const receiptYear = (() => {
          try {
            const y = firstDate ? Number(String(firstDate).slice(0, 4)) : NaN
            return Number.isFinite(y) ? y : new Date().getFullYear()
          } catch {
            return new Date().getFullYear()
          }
        })()

        const { data: budgets, error: budgetsError } = await admin
          .from('family_budgets')
          .select('id, category, subcategory, year, budget_type, target_user_id')
          .eq('family_id', userData.family_id)
          .eq('year', receiptYear)
          .limit(500)

        if (!budgetsError && Array.isArray(budgets) && budgets.length) {
          suggestedBudget = pickBestBudget({
            budgets,
            assignedUserId,
            category: inferred.category || firstCategory,
            subcategory: inferred.subcategory || firstSubcategory,
          })
        }

        const txDateIso = buildTxIso(firstDate, firstTime)
        const txConcept = firstMerchant ? String(firstMerchant) : `Recibo #${receiptData?.id || ''}`.trim() || 'Gasto con comprobante'

        const { data: txData, error: txError } = await admin
          .from('transactions')
          .insert({
            user_id: assignedUserId,
            family_budget_id: suggestedBudget?.id ?? null,
            date: txDateIso,
            amount: chosenAmount,
            transaction_type: 'expense',
            currency: firstCurrency || 'MXN',
            merchant_or_beneficiary: firstMerchant,
            category: inferred.category || firstCategory,
            subcategory: inferred.subcategory || firstSubcategory,
            concept: txConcept,
            reference: firstReference,
            operation_id: firstOperationId,
            tracking_key: firstTrackingKey,
            status: 'processed',
            notes: `Creado automáticamente desde recibo #${receiptData?.id || ''}`.trim(),
          })
          .select()
          .single()

        if (txError) throw txError
        createdTransaction = txData

        // Vincular recibo → transacción y marcar como asignado
        await admin
          .from('receipts')
          .update({ assigned_transaction_id: createdTransaction.id, status: 'assigned' })
          .eq('id', receiptData.id)

        // Actualizar presupuesto de usuario (si existe)
        if (suggestedBudget?.id) {
          const { data: ub } = await admin
            .from('user_budgets')
            .select('id, spent_amount')
            .eq('user_id', assignedUserId)
            .eq('family_budget_id', suggestedBudget.id)
            .single()

          if (ub?.id) {
            await admin
              .from('user_budgets')
              .update({ spent_amount: (ub.spent_amount || 0) + chosenAmount })
              .eq('id', ub.id)
          }
        }

        // Log (best-effort)
        await admin.from('activity_logs').insert({
          user_id: assignedUserId,
          action_type: 'transaction_created_from_receipt',
          entity_type: 'transaction',
          entity_id: createdTransaction?.id ?? null,
          description: `Transaction created from receipt: expense $${chosenAmount} - ${inferred.category || firstCategory || 'N/A'}`,
          details: {
            receipt_id: receiptData?.id,
            transaction_id: createdTransaction?.id,
            family_budget_id: suggestedBudget?.id ?? null,
            category: inferred.category || firstCategory,
            subcategory: inferred.subcategory || firstSubcategory,
          },
        })
      } else {
        // Fallback (sin service role): solo intentamos crear para el usuario autenticado
        // (no permite asignar a otros usuarios ni elegir presupuesto automáticamente)
        if (assignedUserId === authUser.id) {
          const txDateIso = buildTxIso(firstDate, firstTime)
          const txConcept = firstMerchant ? String(firstMerchant) : `Recibo #${receiptData?.id || ''}`.trim() || 'Gasto con comprobante'

          const { data: txData, error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: assignedUserId,
              family_budget_id: null,
              date: txDateIso,
              amount: chosenAmount,
              transaction_type: 'expense',
              currency: firstCurrency || 'MXN',
              merchant_or_beneficiary: firstMerchant,
              category: inferred.category || firstCategory,
              subcategory: inferred.subcategory || firstSubcategory,
              concept: txConcept,
              reference: firstReference,
              operation_id: firstOperationId,
              tracking_key: firstTrackingKey,
              status: 'processed',
              notes: `Creado automáticamente desde recibo #${receiptData?.id || ''}`.trim(),
            })
            .select()
            .single()

          if (!txError && txData?.id) {
            createdTransaction = txData
            await supabase
              .from('receipts')
              .update({ assigned_transaction_id: createdTransaction.id, status: 'assigned' })
              .eq('id', receiptData.id)
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [TX] No se pudo crear transacción automáticamente:', err?.message || err)
    }

    // Cargar recibo completo con items
    const { data: fullReceipt, error: loadError } = await db
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('id', receiptData.id)
      .single()

    if (loadError) {
      console.error('⚠️ [DB] Error cargando recibo completo:', loadError)
      // Retornar el recibo básico si no se puede cargar completo
    }

    const processingTime = Date.now() - startTime
    console.log(`✅ [SUCCESS] Procesamiento completado en ${processingTime}ms`)
    console.log(`   Recibo ID: ${receiptData.id}`)
    console.log(`   Items: ${combinedItems.length}`)
    console.log(`   Monto: ${chosenAmount} ${firstCurrency || 'MXN'}`)

    return NextResponse.json({
      message: 'Recibo procesado y guardado exitosamente',
      receipt: fullReceipt || receiptData,
      receipt_id: receiptData.id,
      transaction: createdTransaction,
      suggested_budget: suggestedBudget,
      parts_status: partsStatus,
      processing_time_ms: processingTime,
      items_count: combinedItems.length,
      amount: chosenAmount,
      currency: firstCurrency || 'MXN'
    })

  } catch (error: any) {
    const processingTime = Date.now() - startTime
    console.error('❌ [ERROR] Error general en procesamiento:', error)
    console.error('   Stack:', error.stack)
    console.error('   Tiempo transcurrido:', processingTime, 'ms')
    
    return NextResponse.json(
      { 
        detail: `Error al procesar recibo: ${error.message || 'Error desconocido'}`,
        error: error.message,
        processing_time_ms: processingTime
      },
      { status: 500 }
    )
  }
}


/**
 * Parsea un valor a float de forma segura
 */
function parseFloatSafe(value: any): number {
  try {
    if (value === null || value === undefined || value === '') return 0.0
    const cleaned = String(value).replace(/,/g, '').replace(/\s/g, '').trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0.0 : parsed
  } catch {
    return 0.0
  }
}

function normText(value: any) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function inferReceiptCategory(args: {
  merchant: string | null
  items: any[]
  aiCategory: string | null
  aiSubcategory: string | null
}) {
  const merchant = normText(args.merchant)
  const itemsText = normText((Array.isArray(args.items) ? args.items : []).map((x: any) => x?.raw_line || '').join(' '))
  const text = `${merchant} ${itemsText}`.toUpperCase()

  // 1) Heurísticas por comercio
  if (/(HEB|H-E-B|WALMART|SORIANA|COSTCO|CHEDRAUI|SUPERAMA|SAMS|SMART|CITY\\s*CLUB|AURRERA)/.test(text)) {
    return { category: 'Mercado', subcategory: 'Mercado General' }
  }
  if (/(PEMEX|SHELL|\\bBP\\b|GASOLIN|OXXO\\s*GAS|MOBIL)/.test(text)) {
    return { category: 'Transporte', subcategory: 'Gasolina' }
  }
  if (/(CFE)/.test(text)) {
    return { category: 'Servicios Basicos', subcategory: 'Electricidad CFE' }
  }
  if (/(TELCEL|AT\\&T|ATT|MOVISTAR)/.test(text)) {
    return { category: 'Servicios Basicos', subcategory: 'Telcel' }
  }
  if (/(TOTALPLAY|MEGACABLE|IZZI|INTERNET)/.test(text)) {
    return { category: 'Servicios Basicos', subcategory: 'Internet' }
  }
  if (/(FARMACIA|BENAVIDES|GUADALAJARA|AHORRO)/.test(text)) {
    return { category: 'Salud', subcategory: 'Medicamentos' }
  }
  if (/(RESTAUR|PIZZA|BURGER|SUSHI|TAQUER|CAFE|STARBUCKS)/.test(text)) {
    return { category: 'Vida Social', subcategory: 'Salidas Personales' }
  }

  // 2) Fallback por categoría IA (mapeo)
  const ai = normText(args.aiCategory)
  if (ai === 'transporte') return { category: 'Transporte', subcategory: args.aiSubcategory || null }
  if (ai === 'salud') return { category: 'Salud', subcategory: args.aiSubcategory || null }
  if (ai === 'educacion') return { category: 'Educacion', subcategory: args.aiSubcategory || null }
  if (ai === 'servicios') return { category: 'Servicios Basicos', subcategory: args.aiSubcategory || null }
  if (ai === 'hogar') return { category: 'Vivienda', subcategory: args.aiSubcategory || null }
  if (ai === 'alimentacion') return { category: 'Mercado', subcategory: 'Mercado General' }

  return { category: null as string | null, subcategory: null as string | null }
}

function buildTxIso(dateOnly: string | null, time24: string | null) {
  try {
    const d = dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : new Date().toISOString().slice(0, 10)
    const t = time24 && /^\d{2}:\d{2}$/.test(time24) ? time24 : '12:00'
    return new Date(`${d}T${t}:00.000Z`).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function pickBestBudget(args: {
  budgets: Array<{ id: number; category: string | null; subcategory: string | null; budget_type: string; target_user_id: string | null }>
  assignedUserId: string
  category: string | null
  subcategory: string | null
}) {
  const cat = normText(args.category)
  const sub = normText(args.subcategory)

  const scored = args.budgets
    .map((b) => {
      const bCat = normText(b.category)
      const bSub = normText(b.subcategory)
      let score = 0
      if (cat && bCat === cat) score += 50
      if (sub && bSub === sub) score += 40
      if (cat && bCat.includes(cat)) score += 8
      if (sub && bSub.includes(sub)) score += 6
      if (b.budget_type === 'individual' && b.target_user_id === args.assignedUserId) score += 10
      if (b.budget_type === 'shared') score += 3
      return { b, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.b || null
}

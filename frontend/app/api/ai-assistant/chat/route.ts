import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIResponse } from '@/lib/services/ai-assistant'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!body.message) {
      return NextResponse.json(
        { detail: 'El mensaje es requerido' },
        { status: 400 }
      )
    }

    // Obtener contexto del usuario
    const userContext: any = {}

    // Obtener resumen de presupuesto
    try {
      const { data: userBudgets } = await supabase
        .from('user_budgets')
        .select('allocated_amount, spent_amount')
        .eq('user_id', authUser.id)

      const totalBudget = userBudgets?.reduce((sum, ub) => sum + (ub.allocated_amount || 0), 0) || 0
      const totalSpent = userBudgets?.reduce((sum, ub) => sum + (ub.spent_amount || 0), 0) || 0

      userContext.budget_summary = {
        total: totalBudget,
        spent: totalSpent,
        available: totalBudget - totalSpent,
      }
    } catch (e) {
      console.error('Error obteniendo contexto de presupuesto:', e)
    }

    // Obtener transacciones recientes
    try {
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('concept, amount, category, date')
        .eq('user_id', authUser.id)
        .order('date', { ascending: false })
        .limit(5)

      userContext.recent_transactions = (recentTransactions || []).map((t: any) => ({
        description: t.concept || 'Sin descripción',
        amount: parseFloat(t.amount || 0),
        category: t.category || 'N/A',
        date: t.date,
      }))
    } catch (e) {
      console.error('Error obteniendo transacciones recientes:', e)
      userContext.recent_transactions = []
    }

    // Obtener items de recibos
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()

      if (userData?.family_id) {
        const { data: receipts } = await supabase
          .from('receipts')
          .select('id, date, merchant_or_beneficiary, created_at')
          .eq('user_id', authUser.id)

        const receiptIds = receipts?.map(r => r.id) || []
        const { data: receiptItems } = await supabase
          .from('receipt_items')
          .select('description, amount, category, subcategory, receipt_id')
          .in('receipt_id', receiptIds)

        userContext.receipt_items = (receiptItems || []).map((item: any) => ({
          description: item.description || 'N/A',
          amount: parseFloat(item.amount || 0),
          category: item.category || 'N/A',
          subcategory: item.subcategory || 'N/A',
        }))
        userContext.receipt_items_count = userContext.receipt_items.length
      }
    } catch (e) {
      console.error('Error obteniendo items de recibos:', e)
      userContext.receipt_items = []
      userContext.receipt_items_count = 0
    }

    // Obtener respuesta del asistente
    const responseText = await getAIResponse(body.message, userContext)

    // Generar ID de conversación
    const conversationId = body.conversation_id || `conv_${authUser.id}_${Date.now()}`

    return NextResponse.json({
      response: responseText,
      conversation_id: conversationId,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/chat:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}

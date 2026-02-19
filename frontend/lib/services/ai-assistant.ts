/**
 * Servicio de asistente inteligente con GPT
 * Requiere: npm install openai
 */

const SYSTEM_CONTEXT = `Eres un asistente financiero inteligente para el sistema Domus Fam, un sistema de gestión de presupuesto familiar.

Tu función es ayudar a los usuarios con:
1. Preguntas sobre cómo usar el sistema (presupuestos, transacciones, recibos, etc.)
2. Consejos financieros y de presupuesto
3. Análisis de patrones de gastos
4. Sugerencias para mejorar el control financiero
5. Explicaciones sobre categorías y subcategorías del sistema

Responde siempre en español, de forma clara y concisa. Si no estás seguro de algo, admítelo y sugiere consultar la documentación.`

let openaiClient: any = null

function getOpenAIClient() {
  if (openaiClient) return openaiClient
  
  try {
    const OpenAI = require('openai')
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return null
    }
    
    openaiClient = new OpenAI({ apiKey })
    return openaiClient
  } catch (error) {
    console.error('OpenAI no disponible:', error)
    return null
  }
}

export async function getAIResponse(
  userMessage: string,
  userContext?: any
): Promise<string> {
  const client = getOpenAIClient()
  if (!client) {
    return 'Lo siento, el asistente de IA no está disponible. Verifica que OpenAI esté configurado.'
  }

  try {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_CONTEXT }
    ]

    if (userContext) {
      let contextText = '\n\nCONTEXTO DEL USUARIO:\n'
      if (userContext.budget_summary) {
        contextText += `- Presupuesto total: $${userContext.budget_summary.total?.toFixed(2) || 0}\n`
        contextText += `- Gastado: $${userContext.budget_summary.spent?.toFixed(2) || 0}\n`
        contextText += `- Disponible: $${userContext.budget_summary.available?.toFixed(2) || 0}\n`
      }
      if (userContext.recent_transactions) {
        contextText += `- Transacciones recientes: ${userContext.recent_transactions.length}\n`
      }
      messages.push({ role: 'system', content: contextText })
    }

    messages.push({ role: 'user', content: userMessage })

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0].message.content.trim()
  } catch (error: any) {
    console.error('Error al obtener respuesta del asistente:', error)
    return 'Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.'
  }
}

export async function analyzeBudgetSituation(
  budgetData: any,
  transactions: any[]
): Promise<string> {
  const client = getOpenAIClient()
  if (!client) {
    return 'El asistente de análisis no está disponible.'
  }

  try {
    const analysisPrompt = `Analiza la siguiente situación financiera y proporciona insights útiles:

PRESUPUESTO:
- Total asignado: $${budgetData.total?.toFixed(2) || 0}
- Gastado: $${budgetData.spent?.toFixed(2) || 0}
- Disponible: $${budgetData.available?.toFixed(2) || 0}
- Porcentaje gastado: ${((budgetData.spent || 0) / (budgetData.total || 1)) * 100}%

TRANSACCIONES RECIENTES (${transactions.length}):
${transactions.slice(0, 10).map((t: any) => 
  `- ${t.description || 'Sin descripción'}: $${t.amount?.toFixed(2) || 0} (${t.category || 'N/A'})`
).join('\n')}

Proporciona:
1. Un análisis breve de la situación
2. Alertas si hay problemas (gastos excesivos, presupuesto agotado, etc.)
3. Recomendaciones prácticas para mejorar el control financiero

Responde en español, de forma clara y concisa.`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.7,
      max_tokens: 400,
    })

    return response.choices[0].message.content.trim()
  } catch (error: any) {
    return `Error al analizar presupuesto: ${error.message}`
  }
}

export async function suggestCategory(
  description: string,
  amount: number,
  availableCategories: string[]
): Promise<any> {
  const client = getOpenAIClient()
  if (!client) {
    return null
  }

  try {
    const prompt = `Basándote en esta transacción, sugiere la categoría y subcategoría más apropiada:

Descripción: "${description}"
Monto: $${amount.toFixed(2)}

Categorías disponibles:
${availableCategories.map(cat => `- ${cat}`).join('\n')}

Responde SOLO con un JSON válido en este formato:
{
    "category": "nombre de la categoría",
    "subcategory": "nombre de la subcategoría",
    "confidence": "alta|media|baja",
    "reason": "breve explicación"
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un asistente que ayuda a categorizar transacciones financieras. Responde SOLO con JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (error: any) {
    console.error('Error al sugerir categoría:', error)
    return null
  }
}

export async function detectAnomalies(
  transactions: any[],
  budgetData?: any
): Promise<any> {
  const client = getOpenAIClient()
  if (!client) {
    return { anomalies: [], message: 'Análisis no disponible' }
  }

  try {
    const transactionsSummary = transactions.slice(0, 50).map((t: any) => ({
      description: (t.description || 'Sin descripción').substring(0, 50),
      amount: parseFloat(t.amount || 0),
      category: t.category || 'N/A',
      date: t.date || 'N/A'
    }))

    const totalAmount = transactionsSummary.reduce((sum, t) => sum + t.amount, 0)

    const prompt = `Analiza estas transacciones y detecta anomalías o patrones inusuales:

RESUMEN:
- Total de transacciones analizadas: ${transactionsSummary.length}
- Monto total: $${totalAmount.toFixed(2)}

TRANSACCIONES:
${transactionsSummary.slice(0, 20).map((t: any) => 
  `- ${t.date}: $${t.amount.toFixed(2)} - ${t.description} (${t.category})`
).join('\n')}

${budgetData ? `PRESUPUESTO:
- Asignado: $${budgetData.total?.toFixed(2) || 0}
- Gastado: $${budgetData.spent?.toFixed(2) || 0}
- Disponible: $${budgetData.available?.toFixed(2) || 0}` : ''}

Detecta:
1. Gastos inusuales (montos muy altos o muy bajos comparados con el promedio)
2. Patrones sospechosos (múltiples transacciones similares, gastos repetitivos)
3. Categorías con gastos desproporcionados
4. Alertas sobre presupuesto (si se proporciona)
5. Recomendaciones específicas

Responde SOLO con un JSON válido:
{
    "anomalies": [
        {
            "type": "gasto_inusual|patron_sospechoso|presupuesto_excedido|categoria_desproporcionada",
            "severity": "alta|media|baja",
            "description": "descripción del problema",
            "transaction": "descripción de la transacción relacionada (si aplica)",
            "recommendation": "recomendación específica"
        }
    ],
    "summary": "resumen general del análisis",
    "recommendations": ["recomendación 1", "recomendación 2"]
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un analista financiero experto que detecta anomalías y patrones en gastos. Responde SOLO con JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (error: any) {
    console.error('Error al detectar anomalías:', error)
    return { anomalies: [], message: `Error: ${error.message}` }
  }
}

export async function predictFutureExpenses(
  transactions: any[],
  monthsAhead: number = 3
): Promise<any> {
  const client = getOpenAIClient()
  if (!client) {
    return { predictions: [], message: 'Predicción no disponible' }
  }

  try {
    // Agrupar por categoría
    const categoryData: Record<string, { amounts: number[], count: number }> = {}
    for (const t of transactions) {
      const category = t.category || 'Desconocida'
      const amount = parseFloat(t.amount || 0)
      if (!categoryData[category]) {
        categoryData[category] = { amounts: [], count: 0 }
      }
      categoryData[category].amounts.push(amount)
      categoryData[category].count++
    }

    const categorySummary = Object.entries(categoryData).map(([cat, data]) => {
      const amounts = data.amounts
      const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
      const total = amounts.reduce((a, b) => a + b, 0)
      const monthlyEstimate = avg * (data.count / Math.max(1, transactions.length / 12))
      return { category: cat, average: avg, total, count: data.count, monthly_estimate: monthlyEstimate }
    })

    const prompt = `Basándote en estos datos históricos, predice los gastos para los próximos ${monthsAhead} meses:

DATOS HISTÓRICOS POR CATEGORÍA:
${categorySummary.sort((a, b) => b.total - a.total).map((c: any) => 
  `- ${c.category}: Promedio $${c.average.toFixed(2)}, Total $${c.total.toFixed(2)}, ${c.count} transacciones, Estimación mensual: $${c.monthly_estimate.toFixed(2)}`
).join('\n')}

Proporciona:
1. Predicción de gastos por categoría para los próximos ${monthsAhead} meses
2. Tendencias identificadas (aumento, disminución, estabilidad)
3. Factores estacionales detectados
4. Recomendaciones de presupuesto

Responde SOLO con un JSON válido:
{
    "predictions": [
        {
            "category": "nombre de categoría",
            "monthly_estimate": 1234.56,
            "trend": "aumentando|disminuyendo|estable",
            "confidence": "alta|media|baja",
            "factors": ["factor 1", "factor 2"]
        }
    ],
    "total_monthly_prediction": 12345.67,
    "trends": "resumen de tendencias generales",
    "recommendations": ["recomendación 1", "recomendación 2"],
    "seasonal_factors": ["factor estacional 1", "factor estacional 2"]
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un analista financiero que predice gastos futuros basado en patrones históricos. Responde SOLO con JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (error: any) {
    console.error('Error al predecir gastos:', error)
    return { predictions: [], message: `Error: ${error.message}` }
  }
}

export async function generateSmartReport(
  budgetData: any,
  transactions: any[],
  period: string = 'mensual'
): Promise<string> {
  const client = getOpenAIClient()
  if (!client) {
    return 'Generación de reporte no disponible'
  }

  try {
    const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    const categoryBreakdown: Record<string, number> = {}
    for (const t of transactions) {
      const cat = t.category || 'Desconocida'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + parseFloat(t.amount || 0)
    }

    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const prompt = `Genera un reporte financiero narrativo profesional para el período ${period}:

SITUACIÓN DEL PRESUPUESTO:
- Presupuesto asignado: $${budgetData.total?.toFixed(2) || 0}
- Total gastado: $${budgetData.spent?.toFixed(2) || 0}
- Disponible: $${budgetData.available?.toFixed(2) || 0}
- Porcentaje utilizado: ${((budgetData.spent || 0) / Math.max(budgetData.total || 1, 1)) * 100}%

GASTOS POR CATEGORÍA (Top 5):
${topCategories.map(([cat, amount]) => 
  `- ${cat}: $${amount.toFixed(2)} (${totalSpent > 0 ? ((amount / totalSpent) * 100).toFixed(1) : 0}%)`
).join('\n')}

NÚMERO DE TRANSACCIONES: ${transactions.length}

Genera un reporte narrativo que incluya:
1. Resumen ejecutivo de la situación financiera
2. Análisis de las categorías principales
3. Comparación con el presupuesto
4. Puntos destacados (positivos y negativos)
5. Recomendaciones específicas y accionables
6. Proyección para el próximo período

El reporte debe ser profesional, claro y útil para la toma de decisiones.`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT + '\n\nEres un analista financiero profesional que genera reportes narrativos claros y accionables.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1200,
    })

    return response.choices[0].message.content.trim()
  } catch (error: any) {
    console.error('Error al generar reporte:', error)
    return `Error al generar reporte: ${error.message}`
  }
}

export async function optimizeBudgetAllocation(
  currentBudgets: any[],
  actualSpending: any[],
  totalBudget: number
): Promise<any> {
  const client = getOpenAIClient()
  if (!client) {
    return { suggestions: [], message: 'Optimización no disponible' }
  }

  try {
    const prompt = `Analiza la asignación actual de presupuesto y sugiere optimizaciones:

PRESUPUESTO ACTUAL:
${currentBudgets.map((b: any) => 
  `- ${b.category}: $${b.allocated.toFixed(2)} (${((b.allocated / totalBudget) * 100).toFixed(1)}%)`
).join('\n')}

GASTOS REALES:
${actualSpending.map((s: any) => {
  const totalSpent = actualSpending.reduce((sum, sp) => sum + (sp.spent || 0), 0)
  return `- ${s.category}: $${s.spent.toFixed(2)} (${totalSpent > 0 ? ((s.spent / totalSpent) * 100).toFixed(1) : 0}%)`
}).join('\n')}

PRESUPUESTO TOTAL DISPONIBLE: $${totalBudget.toFixed(2)}

Analiza:
1. Categorías con presupuesto insuficiente (gastos > presupuesto)
2. Categorías con presupuesto excesivo (gastos << presupuesto)
3. Oportunidades de redistribución
4. Categorías que necesitan más/menos presupuesto

Responde SOLO con un JSON válido:
{
    "optimizations": [
        {
            "category": "nombre de categoría",
            "current_allocation": 1234.56,
            "suggested_allocation": 1500.00,
            "change_percentage": 21.5,
            "reason": "explicación de la sugerencia",
            "priority": "alta|media|baja"
        }
    ],
    "summary": "resumen de las optimizaciones sugeridas",
    "expected_benefits": ["beneficio 1", "beneficio 2"],
    "total_redistribution": 0.00
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un consultor financiero experto en optimización de presupuestos. Responde SOLO con JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (error: any) {
    console.error('Error al optimizar presupuesto:', error)
    return { suggestions: [], message: `Error: ${error.message}` }
  }
}

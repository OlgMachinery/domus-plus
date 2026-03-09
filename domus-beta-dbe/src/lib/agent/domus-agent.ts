/**
 * Agente de IA para DOMUS: responde en lenguaje natural con contexto de la familia
 * (presupuesto resumido, últimos gastos, solicitudes pendientes).
 */

import { prisma } from '@/lib/db/prisma'

const OPENAI_MODEL = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_RECEIPT_MODEL || 'gpt-4o-mini'
const MAX_CONTEXT_TOKENS = 1500

export type AgentContext = {
  familyName: string
  currency: string
  lastTransactions: Array<{ description: string; amount: string; date: string }>
  pendingRequestsCount: number
  userName: string
  /** A2: totales por categoría del mes en curso */
  totalsByCategory: Array<{ categoryName: string; total: number }>
}

export async function buildAgentContext(familyId: string, userId: string, userName: string | null): Promise<AgentContext> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [family, lastTx, pendingCount, txThisMonth] = await Promise.all([
    prisma.family.findUnique({
      where: { id: familyId },
      select: { name: true, currency: true },
    }),
    prisma.transaction.findMany({
      where: { familyId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { description: true, amount: true, date: true },
    }),
    prisma.moneyRequest.count({
      where: { familyId, status: 'PENDING' },
    }),
    prisma.transaction.findMany({
      where: { familyId, date: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, allocation: { select: { category: { select: { name: true } } } } },
    }),
  ])

  const lastTransactions = lastTx.map((t) => ({
    description: (t.description || '—').slice(0, 60),
    amount: String(t.amount),
    date: t.date.toISOString().slice(0, 10),
  }))

  const byCat: Record<string, number> = {}
  for (const t of txThisMonth) {
    const name = t.allocation?.category?.name || 'Sin categoría'
    const amt = Number(t.amount) || 0
    byCat[name] = (byCat[name] || 0) + amt
  }
  const totalsByCategory = Object.entries(byCat)
    .map(([categoryName, total]) => ({ categoryName, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  return {
    familyName: family?.name || 'Familia',
    currency: family?.currency || 'MXN',
    lastTransactions,
    pendingRequestsCount: pendingCount,
    userName: userName || 'Usuario',
    totalsByCategory,
  }
}

function formatContextForPrompt(ctx: AgentContext): string {
  const lines: string[] = [
    `Familia: ${ctx.familyName}. Moneda: ${ctx.currency}.`,
    `Usuario: ${ctx.userName}.`,
    `Solicitudes de efectivo pendientes: ${ctx.pendingRequestsCount}.`,
  ]
  if (ctx.totalsByCategory?.length) {
    lines.push('Gasto del mes por categoría:')
    ctx.totalsByCategory.slice(0, 10).forEach((c) => {
      lines.push(`  ${c.categoryName}: $${c.total}`)
    })
  }
  if (ctx.lastTransactions.length) {
    lines.push('Últimos gastos registrados:')
    ctx.lastTransactions.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.date} — ${t.description} — $${t.amount}`)
    })
  } else if (!ctx.totalsByCategory?.length) {
    lines.push('Aún no hay gastos registrados este periodo.')
  }
  return lines.join('\n')
}

const SYSTEM_PROMPT = `Eres el asistente de DOMUS, una app de presupuesto familiar. Respondes por WhatsApp, en español, de forma breve y clara (máximo 3-4 frases salvo que pidan un resumen). Tienes autonomía para responder con los datos del contexto sin pedir que revisen la app si ya puedes contestar.

Tienes contexto de la familia: nombre, moneda, últimos gastos y cantidad de solicitudes de efectivo pendientes.

Puedes:
- Responder cuánto se ha gastado usando los últimos gastos del contexto (este mes, recientes, etc.).
- Decir cuántas solicitudes de efectivo están pendientes y resumir si te lo piden.
- Explicar cómo registrar un gasto: "Envía monto y concepto (ej. 500 cine Sofía) o una foto/PDF del recibo."
- Explicar solicitud de efectivo: pueden hacerla por aquí con "solicitud 500 motivo", "necesito 300 super" o "quiero 200 para farmacia"; también desde la app (Solicitudes → Solicitud de efectivo).
- Explicar reasignar: "Responde al mensaje de confirmación con 'para [nombre]' o escribe la clave y asignación: E-ABC12 cumpleaños Sofía."

No inventes montos ni datos que no estén en el contexto. Si tienes la información en el contexto, responde directamente. Si el mensaje parece un gasto mal formado (ej. "500 cine" sin más), indica: "Para registrar ese gasto envía: 500 cine [opcional: para Sofía]. O envía una foto del recibo."`

/**
 * Obtiene una respuesta del agente dado el mensaje del usuario y el contexto de la familia.
 * Usa OPENAI_API_KEY. Si falla o no hay API key, devuelve null.
 */
export async function getAgentReply(
  message: string,
  familyId: string,
  userId: string,
  userName: string | null,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !message?.trim()) return null

  const context = await buildAgentContext(familyId, userId, userName)
  const contextBlock = formatContextForPrompt(context)
  const systemContent = `${SYSTEM_PROMPT}\n\nContexto actual:\n${contextBlock}`

  const payload = {
    model: OPENAI_MODEL,
    max_tokens: 400,
    messages: [
      { role: 'system' as const, content: systemContent },
      { role: 'user' as const, content: message.trim().slice(0, 500) },
    ],
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('DOMUS agent OpenAI error:', json?.error?.message || res.status)
      return null
    }
    const content = json?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content.trim() : null
  } catch (e) {
    console.error('DOMUS agent fetch error:', e)
    return null
  }
}

export type SuggestCategoryResult =
  | { type: 'from_list'; name: string }
  | { type: 'suggest_new'; name: string }
  | null

/**
 * Pide a la IA que clasifique un recibo: elegir una categoría existente o sugerir una nueva
 * si ninguna encaja bien (ej. repostería y la familia no tiene "Comida"). Así el admin puede
 * aprobar la sugerencia y el sistema se va afinando.
 */
export async function suggestCategoryForReceipt(
  merchantName: string,
  rawTextSnippet: string,
  categoryNames: string[],
): Promise<SuggestCategoryResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const list = categoryNames.length > 0 ? categoryNames.map((n) => `"${n}"`).join(', ') : '(ninguna)'
  const prompt = `Recibo de compra. Comercio: ${merchantName || 'no indicado'}. Texto del recibo (resumen): ${rawTextSnippet.slice(0, 350).trim() || 'sin texto'}.

Categorías permitidas (responde ÚNICAMENTE una de estas, copiando el nombre exacto): ${list}.

Reglas:
1. Elige la categoría que mejor encaje (ej. supermercado/tienda → Alimentos; luz/CFE → Servicios; cine → Entretenimiento; pastelería/cake/repostería/panadería → Comida o Alimentos). Responde SOLO ese nombre, tal cual está en la lista.
2. NUNCA clasifiques pastelerías, reposterías, tiendas de pasteles/cake o panaderías como Renta o Hipoteca; usa Comida, Alimentos o similar si existe en la lista.
3. Si ninguna encaja pero el gasto es claro, responde exactamente: NUEVA: NombreDeLaCategoría (ej. NUEVA: Repostería). Una sola categoría, nombre corto.
No añadas puntos, explicación ni comillas. Una sola línea.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 80,
        temperature: 0,
        messages: [
          { role: 'system' as const, content: 'Respondes solo con el nombre exacto de una categoría de la lista, o NUEVA: Nombre si propones una nueva. No uses Renta ni Hipoteca para comercios de comida, pasteles, repostería o panadería. Una línea, sin explicación ni puntuación extra.' },
          { role: 'user' as const, content: prompt },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '').replace(/\s+/g, ' ')
    const chosenRaw = content.replace(/^["']|["']$/g, '').trim().split(/[.\n]/)[0]?.trim() || ''

    const nuevaMatch = content.match(/^NUEVA:\s*(.+)$/i)
    if (nuevaMatch) {
      const name = nuevaMatch[1]!.trim().replace(/^["']|["']$/g, '')
      if (name.length >= 2 && name.length <= 60) return { type: 'suggest_new', name }
    }

    if (categoryNames.length === 0) return null
    const chosen = chosenRaw
    const exact = categoryNames.find((c) => norm(c) === norm(chosen))
    if (exact) return { type: 'from_list', name: exact }
    const byContains = categoryNames.find((c) => norm(chosen).includes(norm(c)) || norm(c).includes(norm(chosen)))
    if (byContains) return { type: 'from_list', name: byContains }
    return null
  } catch (e) {
    console.warn('suggestCategoryForReceipt:', e)
    return null
  }
}

/** A1: Sugiere allocationId para un recibo (comercio + texto). Usa categoría IA y elige la mejor asignación. */
export type AllocationOption = { id: string; entityName: string; categoryName: string }
export async function suggestAllocationForReceipt(
  merchantName: string,
  rawTextSnippet: string,
  allocations: AllocationOption[],
  categoryHintFromPreference: string | null,
): Promise<string | null> {
  let categoryName: string | null = categoryHintFromPreference
  if (!categoryName && allocations.length > 0) {
    const categoryNames = [...new Set(allocations.map((a) => a.categoryName).filter(Boolean))]
    const result = await suggestCategoryForReceipt(merchantName, rawTextSnippet, categoryNames)
    if (result?.type === 'from_list') categoryName = result.name
  }
  if (!categoryName || !allocations.length) return null
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
  const catNorm = norm(categoryName)
  const match = allocations.find((a) => norm(a.categoryName) === catNorm || a.categoryName.includes(categoryName!))
  return match?.id ?? allocations[0]?.id ?? null
}

/** B3: Dado un concepto corto y categorías de la familia, devuelve nombre de categoría o sugiere nueva. */
export async function resolveCategoryFromConcept(
  concept: string,
  categoryNames: string[],
): Promise<{ type: 'from_list'; name: string } | { type: 'suggest_new'; name: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !concept?.trim()) return null
  const list = categoryNames.length > 0 ? categoryNames.map((n) => `"${n}"`).join(', ') : '(ninguna)'
  const prompt = `Concepto de gasto o motivo: "${concept.trim().slice(0, 200)}". Categorías del presupuesto: ${list}. Responde SOLO el nombre exacto de la categoría que encaje, o NUEVA: Nombre si propones una nueva. Una línea, sin explicación.`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 60,
        messages: [
          { role: 'system' as const, content: 'Solo nombre de categoría de la lista, o NUEVA: Nombre. Una línea.' },
          { role: 'user' as const, content: prompt },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
    const nuevaMatch = content.match(/^NUEVA:\s*(.+)$/i)
    if (nuevaMatch) {
      const name = nuevaMatch[1]!.trim().replace(/^["']|["']$/g, '')
      if (name.length >= 2 && name.length <= 60) return { type: 'suggest_new', name }
    }
    const chosen = content.replace(/^["']|["']$/g, '')
    const match = categoryNames.find((c) => norm(c) === norm(chosen) || chosen.includes(c))
    return match ? { type: 'from_list', name: match } : null
  } catch (e) {
    console.warn('resolveCategoryFromConcept:', e)
    return null
  }
}

/** B1: Normaliza texto libre a gasto { amount, concept, recipientName }. Ej: "gasté 500 en cine" → { amount: 500, concept: "cine", recipientName: null }. */
export async function normalizeExpenseMessage(text: string): Promise<{ amount: number; concept: string; recipientName: string | null } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !text?.trim() || text.length > 200) return null
  const prompt = `Extrae de este mensaje sobre un gasto: monto en números, concepto breve (ej. cine, super, farmacia), y si menciona "para [nombre]" el nombre. Responde SOLO en JSON: {"amount": número, "concept": "texto", "recipientName": "nombre o null"}. Sin explicación. Mensaje: "${text.trim().slice(0, 300)}"`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 80,
        messages: [
          { role: 'system' as const, content: 'Respondes únicamente JSON válido: {"amount": number, "concept": string, "recipientName": string|null}' },
          { role: 'user' as const, content: prompt },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    const parsed = JSON.parse(content.replace(/^```\w*\n?|```$/g, '').trim())
    const amount = Number(parsed?.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null
    const concept = typeof parsed?.concept === 'string' ? parsed.concept.trim() : ''
    if (!concept) return null
    const recipientName = typeof parsed?.recipientName === 'string' && parsed.recipientName.trim() ? parsed.recipientName.trim() : null
    return { amount, concept, recipientName }
  } catch (e) {
    return null
  }
}

/** A3: Detecta si el mensaje es solicitud de efectivo y extrae monto y motivo (fallback cuando regex no matchea). */
export async function parseMoneyRequestFromText(text: string): Promise<{ amount: number; reason: string; forName?: string | null } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !text?.trim() || text.length > 250) return null
  const prompt = `¿Este mensaje es una solicitud de dinero/efectivo (pedir prestado, adelanto, "necesito X", "dame X")? Si SÍ, extrae monto numérico y motivo breve. Responde SOLO JSON: {"isMoneyRequest": true/false, "amount": número o 0, "reason": "texto", "forName": "nombre si dice para quién o null"}. Mensaje: "${text.trim().slice(0, 250)}"`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 100,
        messages: [
          { role: 'system' as const, content: 'Solo JSON: {"isMoneyRequest": bool, "amount": number, "reason": string, "forName": string|null}' },
          { role: 'user' as const, content: prompt },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    const parsed = JSON.parse(content.replace(/^```\w*\n?|```$/g, '').trim())
    if (!parsed?.isMoneyRequest || !Number.isFinite(parsed?.amount) || parsed.amount <= 0) return null
    const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim() : ''
    if (!reason) return null
    const forName = typeof parsed?.forName === 'string' && parsed.forName.trim() ? parsed.forName.trim() : null
    return { amount: Number(parsed.amount), reason, forName: forName || undefined }
  } catch (e) {
    return null
  }
}

/** C1: Dado texto de reasignación (ej. "cumpleaños mamá") y listas, devuelve categoryHint y entityHint. */
export async function parseReassignHints(
  text: string,
  options: { entityNames: string[]; categoryNames: string[] },
): Promise<{ categoryHint: string | null; entityHint: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !text?.trim()) return { categoryHint: null, entityHint: null }
  const entityList = options.entityNames.slice(0, 20).join(', ')
  const catList = options.categoryNames.slice(0, 30).join(', ')
  const prompt = `Texto de asignación: "${text.trim().slice(0, 150)}". Entidades (personas/cosas): ${entityList}. Categorías: ${catList}. Responde JSON: {"categoryHint": "nombre categoría o null", "entityHint": "nombre entidad o null"}. Si "mamá"/"esposa" puede ser una entidad, usa entityHint. Una línea JSON.`
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 80,
        messages: [
          { role: 'system' as const, content: 'Solo JSON: {"categoryHint": string|null, "entityHint": string|null}' },
          { role: 'user' as const, content: prompt },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return { categoryHint: null, entityHint: null }
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    const parsed = JSON.parse(content.replace(/^```\w*\n?|```$/g, '').trim())
    return {
      categoryHint: typeof parsed?.categoryHint === 'string' && parsed.categoryHint ? parsed.categoryHint.trim() : null,
      entityHint: typeof parsed?.entityHint === 'string' && parsed.entityHint ? parsed.entityHint.trim() : null,
    }
  } catch (e) {
    return { categoryHint: null, entityHint: null }
  }
}

/** C2: Extrae "para [nombre]" del motivo de solicitud. */
export function extractRecipientFromReason(reason: string): string | null {
  const m = reason.match(/\b(?:para|a)\s+([^\d,.\n]+?)(?:\s+[-–—]|\s*$)/i) || reason.match(/\b(?:para|a)\s+(\S+(?:\s+\S+)*)$/i)
  if (m) {
    const name = m[1]!.trim()
    if (name.length >= 2 && name.length <= 50) return name
  }
  return null
}

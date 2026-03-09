import sharp from 'sharp'

type OpenAiJson = Record<string, any>

export type ReceiptExtractionNormalized = {
  merchantName: string | null
  date: string | null // YYYY-MM-DD
  time: string | null // HH:MM
  total: number | null
  currency: string
  tax: number | null
  tip: number | null
  items: Array<{
    lineNumber: number
    description: string
    rawLine: string | null
    quantity: number | null
    unitPrice: number | null
    amount: number | null
    isAdjustment: boolean
    isPlaceholder: boolean
    lineType: string | null
    notes: Record<string, any>
    quantityUnit: string | null // "g", "kg", "L", "ml", "unidades"
  }>
  rawText: string | null
  meta: Record<string, any>
  raw: {
    itemsParts: OpenAiJson[]
    totalsParts: OpenAiJson[]
  }
  // Consumo (recibos luz/agua)
  receiptType?: string | null
  consumptionQuantity?: number | null
  consumptionUnit?: string | null
  consumptionPeriodStart?: string | null // ISO date
  consumptionPeriodEnd?: string | null
}

const PROMPT_ITEMS = `MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos) — ITEMS.

Devuelve EXCLUSIVAMENTE JSON válido (sin texto antes/después).

PRIORIDAD #1 (CRÍTICA): extraer el GRAN TOTAL (TOTAL A PAGAR / IMPORTE TOTAL / TOTAL).
- \`amount_raw\` debe ser SOLO el monto del GRAN TOTAL (ej. "1234.56" o "1,234.56"), copiado tal cual.
- Si en ESTA imagen/corte NO se ve claramente el renglón del TOTAL, devuelve \`amount_raw\` como "" (vacío).
- NO confundas el TOTAL con: folio/ticket, número de transacción, caja, autorización, IVA, subtotal, cambio, pago, puntos, etc.

Formato de salida:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount_raw": "",
  "currency": "MXN",
  "merchant_or_beneficiary": "",
  "items": [
    {
      "line_number": 1,
      "raw_line": "renglón completo tal cual",
      "quantity_raw": "",
      "unit_price_raw": "",
      "total_raw": ""
    }
  ]
}

Reglas para ITEMS:
- Cada renglón impreso que represente un artículo/concepto = 1 item (MANTÉN el orden original).
- Usa \`raw_line\` con el texto completo del renglón. Si el renglón no se entiende, usa "no legible".
- \`quantity_raw\`, \`unit_price_raw\`, \`total_raw\`: copia EXACTO lo impreso. Si no es legible, usa "no legible". Si no aparece en ese renglón, deja "".
- No normalices ni deduzcas campos faltantes.
- No incluyas subtotales, impuestos, promociones/descuentos, pagos, cambio, propina ni el total como items.

CRÍTICO (anti-alucinación):
- NO INVENTES items. Si no puedes leer un renglón, usa 'no legible'.
- Si no puedes ver claramente TODO el recibo en este corte, está BIEN devolver menos items.
- NUNCA rellenes con items plausibles (ej. 'tacos', 'menú', etc.).`

const PROMPT_TOTALS = `MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos) — TOTALES.

Devuelve EXCLUSIVAMENTE JSON válido (sin texto antes/después).

Objetivo: extraer el GRAN TOTAL con MÁXIMA precisión (copiar tal cual).
IMPORTANTE:
- NO adivines. Si no estás 100% seguro del monto, deja el campo vacío.
- Incluye el renglón completo donde aparece el total para verificación.
- Si aparece el conteo de artículos ("ARTICULOS COMPRADOS: 127"), extráelo también.

Formato de salida:
{
  "amount_raw": "",
  "total_line_raw": "",
  "currency": "MXN",
  "subtotal_raw": "",
  "taxes": [
    { "label": "IVA", "amount_raw": "" },
    { "label": "IEPS", "amount_raw": "" }
  ],
  "items_count": null,
  "items_count_line_raw": ""
}

Reglas:
- \`amount_raw\`: SOLO el monto del GRAN TOTAL (ej. "6345.00" o "6,345.00").
- \`total_line_raw\`: el renglón completo exacto donde aparece el GRAN TOTAL (ej. "Venta Total 6345.00").
- \`items_count\`: número entero si es legible; si no, null.
- Si un campo no se ve claramente, deja "" (o null para items_count).`

const PROMPT_TOTALS_LINES = `Devuelve SOLO JSON válido (sin texto antes/después).

Objetivo: en la sección final del ticket (totales), lista las líneas IMPORTANTES y los números EXACTOS que veas.

Reglas:
- NO adivines: si un número no se ve claro, NO lo escribas.
- Incluye TODAS las líneas donde aparezca el total (a veces se repite).
- Copia la línea tal cual se ve (texto + número).

Formato:
{
  "lines": ["..."],
  "numbers": ["..."]
}`

function parseJsonFromText(text: unknown): any {
  const t = String(text || '').trim()
  if (!t) throw new Error('Respuesta vacía del extractor')
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
    throw new Error('La respuesta del extractor no es JSON')
  }
}

function extractNumberCandidates(text: string): number[] {
  const tokens = String(text || '').match(/-?\d[\d.,]*\d/g) || []
  const out: number[] = []
  for (const tok of tokens) {
    try {
      let s = tok.trim()
      if (s.includes(',') && s.includes('.')) {
        s = s.replace(/,/g, '')
      } else if (s.includes(',') && !s.includes('.')) {
        const parts = s.split(',')
        if (parts.length === 2 && (parts[1]?.length === 1 || parts[1]?.length === 2)) {
          s = `${parts[0]}.${parts[1]}`
        } else {
          s = parts.join('')
        }
      }
      const v = Number(s)
      if (Number.isFinite(v)) out.push(v)
    } catch {
      // ignore
    }
  }
  // unique preserve order
  const seen = new Set<string>()
  const uniq: number[] = []
  for (const v of out) {
    const key = v.toFixed(4)
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push(v)
  }
  return uniq
}

function pickLargestNumberInLine(line: string): number | null {
  const nums = extractNumberCandidates(line)
  if (!nums.length) return null
  let best = nums[0]!
  for (const n of nums) if (n > best) best = n
  return best > 0 ? best : null
}

function toCents(value: unknown): number {
  if (value === null || value === undefined) return 0
  let v = String(value).replace(/,/g, '').trim()
  if (!v) return 0
  let negative = false
  // "0.57-" style
  if (v.endsWith('-') && !v.startsWith('-')) {
    negative = true
    v = v.slice(0, -1).trim()
  }
  // "(123.45)" style
  if (v.startsWith('(') && v.endsWith(')')) {
    negative = true
    v = v.slice(1, -1).trim()
  }

  // Keep only last numeric token (handles "$ 1,234.50 MXN")
  const matches = v.match(/-?\d+(?:[.,]\d+)?/g)
  if (!matches || matches.length < 1) return 0
  let num = matches[matches.length - 1] || ''
  if (num.startsWith('-')) {
    negative = true
    num = num.slice(1)
  }

  // Normalize separators
  if (num.includes(',') && num.includes('.')) {
    num = num.replace(/,/g, '')
  } else if (num.includes(',') && !num.includes('.')) {
    const parts = num.split(',')
    if (parts.length === 2 && (parts[1]?.length === 1 || parts[1]?.length === 2)) {
      num = `${parts[0]}.${parts[1]}`
    } else {
      num = parts.join('')
    }
  }

  const n = Number(num)
  if (!Number.isFinite(n)) return 0
  const cents = Math.round(n * 100)
  return negative ? -cents : cents
}

function parseFloatSafe(value: unknown): number {
  return toCents(value) / 100
}

/** Parsea cantidad + unidad en una línea (ej. "500G", "1.5 L", "2 KG") para reportes de consumo. */
function parseQuantityUnitFromLine(line: string): { quantity: number; unit: string } | null {
  const s = String(line || '').trim()
  if (!s) return null
  // Patrones: 500G, 500 G, 1.5L, 1.5 L, 2KG, 2.5 KG, 750 ML, 1 UNIDAD
  const m = s.match(
    /(\d+(?:[.,]\d+)?)\s*(G|GR|GRAMOS?|KG|KILOS?|KGS?|L|LT|LITROS?|ML|MILILITROS?|UNIDADES?|UN|PZAS?|PIEZAS?)/i
  )
  if (!m) return null
  let q = (m[1] || '').replace(',', '.')
  const num = Number(q)
  if (!Number.isFinite(num) || num <= 0) return null
  const u = (m[2] || '').toUpperCase()
  let unit = 'unidades'
  if (/^G(RAMOS?)?$/i.test(u)) unit = 'g'
  else if (/^K(G|ILOS?|GS?)?$/i.test(u)) unit = 'kg'
  else if (/^L(T|ITROS?)?$/i.test(u) && !/^ML/i.test(u)) unit = 'L'
  else if (/^M(L|ILILITROS?)?$/i.test(u)) unit = 'ml'
  else if (/UN(IDADES?)?$|PZAS?|PIEZAS?/i.test(u)) unit = 'unidades'
  return { quantity: num, unit }
}

/** Detecta recibo de servicio (luz/agua) y extrae consumo y periodo desde rawText. */
function parseConsumptionFromRawText(rawText: string | null): {
  receiptType: 'utility'
  consumptionQuantity: number
  consumptionUnit: string
  periodStart: string | null
  periodEnd: string | null
} | null {
  const text = String(rawText || '').toUpperCase()
  if (!text) return null
  const isLuz = /CFE|ELECTRICIDAD|KWH|KW\.?H|ENERG[IÍ]A|LECTURA|CONSUMO\s*KWH/i.test(text)
  const isAgua = /AGUA|M3|M³|METROS?\s*C[UÚ]BICOS|CONSUMO\s*M3|LECTURA/i.test(text)
  if (!isLuz && !isAgua) return null

  let consumptionQuantity = 0
  let consumptionUnit = 'kWh'
  if (isLuz) {
    const kwhMatch = text.match(/(\d+(?:[.,]\d+)?)\s*K\.?W\.?H/i) || text.match(/CONSUMO[:\s]*(\d+(?:[.,]\d+)?)/i)
    if (kwhMatch) {
      consumptionQuantity = Number((kwhMatch[1] || '').replace(',', '.'))
      consumptionUnit = 'kWh'
    }
  }
  if (isAgua && consumptionQuantity === 0) {
    const m3Match = text.match(/(\d+(?:[.,]\d+)?)\s*M\.?3/i) || text.match(/(\d+(?:[.,]\d+)?)\s*M³/i) || text.match(/CONSUMO[:\s]*(\d+(?:[.,]\d+)?)/i)
    if (m3Match) {
      consumptionQuantity = Number((m3Match[1] || '').replace(',', '.'))
      consumptionUnit = 'm3'
    }
  }
  if (consumptionQuantity <= 0) return null

  // Periodo: buscar fechas tipo "01/ENE/2025 - 28/ENE/2025" o "PERIODO 01-01-2025 31-01-2025"
  let periodStart: string | null = null
  let periodEnd: string | null = null
  const periodMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[^\d]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  const dateChunk = periodMatch ? periodMatch.slice(1) : null
  if (dateChunk && dateChunk.length >= 6) {
    const d1 = [dateChunk[0], dateChunk[1], dateChunk[2].length === 2 ? `20${dateChunk[2]}` : dateChunk[2]]
    const d2 = [dateChunk[3], dateChunk[4], dateChunk[5].length === 2 ? `20${dateChunk[5]}` : dateChunk[5]]
    periodStart = `${d1[2]}-${d1[1]!.padStart(2, '0')}-${d1[0]!.padStart(2, '0')}`
    periodEnd = `${d2[2]}-${d2[1]!.padStart(2, '0')}-${d2[0]!.padStart(2, '0')}`
  }

  return { receiptType: 'utility', consumptionQuantity, consumptionUnit, periodStart, periodEnd }
}

function normalizeForMatch(text: string): string {
  const s0 = String(text || '').toUpperCase().trim().replace(/\s+/g, ' ')
  return s0.replace(/[^A-Z0-9 ]+/g, '')
}

function isProbableBoundaryDuplicate(item: any, tailItem: any): boolean {
  const aLine = normalizeForMatch(String(item?.raw_line || item?.rawLine || ''))
  const bLine = normalizeForMatch(String(tailItem?.raw_line || tailItem?.rawLine || ''))
  if (!aLine || !bLine) return false

  const aTotal = parseFloatSafe(item?.total_raw ?? item?.totalRaw)
  const bTotal = parseFloatSafe(tailItem?.total_raw ?? tailItem?.totalRaw)
  if (aTotal > 0 && bTotal > 0) {
    const diff = Math.abs(aTotal - bTotal)
    const tol = Math.max(1.0, Math.max(aTotal, bTotal) * 0.03)
    if (diff > tol) return false
  }

  if (aLine.replace(/ /g, '') === bLine.replace(/ /g, '')) return true
  // Fuzzy (simple): allow small OCR diffs
  const a = aLine.split(' ')
  const b = bLine.split(' ')
  const common = a.filter((w) => b.includes(w)).length
  const denom = Math.max(1, Math.max(a.length, b.length))
  const sim = common / denom
  return sim >= 0.9
}

function mergeItemsWithOverlapDedupe(partsItems: any[][], tailWindow = 60, boundaryWindow = 45) {
  const merged: any[] = []
  let removed = 0
  for (const partItems of partsItems) {
    if (!Array.isArray(partItems) || partItems.length < 1) continue
    if (merged.length < 1) {
      merged.push(...partItems)
      continue
    }
    const tail = merged.slice(Math.max(0, merged.length - tailWindow))
    for (let idx = 0; idx < partItems.length; idx += 1) {
      const it = partItems[idx]
      if (idx < boundaryWindow && tail.some((t) => isProbableBoundaryDuplicate(it, t))) {
        removed += 1
        continue
      }
      merged.push(it)
    }
  }
  return { merged, removed }
}

function interleavePlaceholdersEvenly(items: any[], placeholders: any[]) {
  if (!placeholders.length) return items
  if (!items.length) return [...placeholders]
  const m = items.length
  const n = placeholders.length
  const insertAfter = Array.from({ length: n }, (_, i) => Math.floor(((i + 1) * m) / (n + 1)))
  const out: any[] = []
  let p = 0
  let count = 0
  while (p < n && insertAfter[p] === 0) {
    out.push(placeholders[p])
    p += 1
  }
  for (const it of items) {
    out.push(it)
    count += 1
    while (p < n && insertAfter[p] === count) {
      out.push(placeholders[p])
      p += 1
    }
  }
  while (p < n) {
    out.push(placeholders[p])
    p += 1
  }
  return out
}

function pickDeclaredTotal(itemsRaws: any[], sumItems: number, maxItem: number): { total: number; source: string | null } {
  let bestTotal = 0
  let bestScore: number | null = null
  let bestSource: string | null = null

  for (let i = 0; i < itemsRaws.length; i += 1) {
    const raw = itemsRaws[i]
    const amountText = String(raw?.amount_raw || '').trim()
    const declaredCents = raw?.declared_total_cents
    const hasKw = amountText ? /TOTAL|A PAGAR|IMPORTE/i.test(amountText) : false

    const candidates: number[] = []
    if (Number.isInteger(declaredCents) && declaredCents > 0) candidates.push(declaredCents / 100)
    if (amountText) candidates.push(...extractNumberCandidates(amountText))

    for (const c of candidates) {
      if (!(c > 0)) continue
      if (maxItem > 0 && c + 0.01 < maxItem) continue
      const diff = sumItems > 0 ? Math.abs(c - sumItems) : 0
      let score = diff
      if (hasKw) score *= 0.6
      if (Math.abs(c - Math.round(c)) < 1e-9) score *= 1.1
      if (bestScore === null || score < bestScore) {
        bestScore = score
        bestTotal = c
        bestSource = `part_${i + 1}`
      }
    }
  }

  return { total: bestTotal, source: bestSource }
}

function pickDeclaredTotalV2(args: {
  itemsRaws: any[]
  totalsRaws: any[]
  sumItems: number
  maxItem: number
}): { total: number; source: string | null; chosenTotalsRaw: any | null } {
  const { itemsRaws, totalsRaws, sumItems, maxItem } = args
  let bestTotal = 0
  let bestScore: number | null = null
  let bestSource: string | null = null
  let bestRaw: any | null = null

  // Contexto global: si alguna foto trae subtotal (y/o impuestos), evita elegir “totales” absurdos
  // (ej. confundir un item con el total, o leer el encabezado de columna “TOTAL”).
  let globalSubtotalAny = 0
  let globalSubtotalForExpected = 0
  let globalExpected: number | null = null
  for (const raw of totalsRaws || []) {
    const subtotal = parseFloatSafe(raw?.subtotal_raw)
    if (subtotal > globalSubtotalAny) globalSubtotalAny = subtotal
    let taxTotal = 0
    try {
      for (const t of raw?.taxes || []) taxTotal += parseFloatSafe(t?.amount_raw)
    } catch {
      taxTotal = 0
    }
    if (subtotal > 0 && taxTotal > 0 && subtotal > globalSubtotalForExpected) {
      globalSubtotalForExpected = subtotal
      globalExpected = subtotal + taxTotal
    }
  }

  for (let i = 0; i < (totalsRaws || []).length; i += 1) {
    const raw = totalsRaws[i]
    const amountText = String(raw?.amount_raw || '').trim()
    const totalLine = String(raw?.total_line_raw || '').trim()
    const hasKw = totalLine ? /TOTAL|A PAGAR|IMPORTE/i.test(totalLine) : false
    const lineHasDigits = totalLine ? /\d/.test(totalLine) : false
    const isHeaderLike =
      !lineHasDigits && /ART[IÍ]C|ART[IÍ]CULO|CANT|PRE\.?\s*UNI|PRECIO|P\.?\s*UNIT|UNIT/i.test(totalLine) && /TOTAL/i.test(totalLine)
    const kwStrong = hasKw && lineHasDigits && !isHeaderLike

    const lineCandidates: number[] = totalLine ? extractNumberCandidates(totalLine) : []
    const amountCandidates: number[] = []
    const declaredCents = raw?.declared_total_cents
    if (Number.isInteger(declaredCents) && declaredCents > 0) amountCandidates.push(declaredCents / 100)
    if (amountText) amountCandidates.push(...extractNumberCandidates(amountText))

    const subtotal = parseFloatSafe(raw?.subtotal_raw)
    let taxTotal = 0
    try {
      for (const t of raw?.taxes || []) taxTotal += parseFloatSafe(t?.amount_raw)
    } catch {
      taxTotal = 0
    }
    const expectedFromSubtotal = subtotal > 0 && taxTotal > 0 ? subtotal + taxTotal : null
    const expectedFromItems = sumItems > 0 && taxTotal > 0 ? sumItems + taxTotal : null
    // Para totales, preferimos Subtotal+Impuestos cuando exista.
    const expected = expectedFromSubtotal ?? expectedFromItems ?? null

    const computedCandidates: Array<{ value: number; kind: 'expected_subtotal_plus_tax' | 'expected_items_plus_tax' }> = []
    if (expectedFromSubtotal !== null) {
      computedCandidates.push({ value: Math.round(expectedFromSubtotal * 100) / 100, kind: 'expected_subtotal_plus_tax' })
    } else if (expectedFromItems !== null) {
      // Respaldo: depende de suma de items (puede estar incompleta).
      computedCandidates.push({ value: Math.round(expectedFromItems * 100) / 100, kind: 'expected_items_plus_tax' })
    }

    const sumWeight = expected !== null ? 0.01 : 0.1

    // 1) Preferimos candidatos extraídos (amount_raw / total_line_raw / declared_total_cents)
    const extractedCandidates: Array<{ value: number; fromLine: boolean }> = []
    for (const c of lineCandidates) extractedCandidates.push({ value: c, fromLine: true })
    for (const c of amountCandidates) extractedCandidates.push({ value: c, fromLine: false })

    for (const cand of extractedCandidates) {
      const c = cand.value
      if (!(c > 0)) continue
      if (maxItem > 0 && c + 0.01 < maxItem) continue
      if (globalSubtotalAny > 0 && c + 0.01 < globalSubtotalAny * 0.6) continue

      let score = 0
      if (isHeaderLike) score += 120
      if (kwStrong) score -= 100
      else if (hasKw) score -= 30
      if (cand.fromLine) score -= 10
      if (globalExpected !== null && globalExpected > 0) score += Math.abs(c - globalExpected)
      // Si no hay expected global, usa el expected del mismo corte.
      if (globalExpected === null && expected !== null && expected > 0) score += Math.abs(c - expected)
      // Si hay ambos, usa expected local como señal débil (evita doble castigo).
      if (globalExpected !== null && expected !== null && expected > 0) score += Math.abs(c - expected) * 0.2
      if (Math.abs(c - Math.round(c)) < 1e-9) score += 1
      if (sumItems > 0) score += Math.abs(c - sumItems) * sumWeight

      if (bestScore === null || score < bestScore) {
        bestScore = score
        bestTotal = c
        bestSource = `totals_part_${i + 1}`
        bestRaw = raw
      }
    }

    // 2) Respaldo aritmético: si Subtotal+Impuestos (y/o Items+Impuestos) cuadra, úsalo.
    for (const cand of computedCandidates) {
      const c = cand.value
      if (!(c > 0)) continue
      if (maxItem > 0 && c + 0.01 < maxItem) continue

      let score = 0
      // sin bonus de keyword (no viene de una línea específica)
      if (expected !== null && expected > 0) score += Math.abs(c - expected)
      if (Math.abs(c - Math.round(c)) < 1e-9) score += 1
      if (sumItems > 0) score += Math.abs(c - sumItems) * sumWeight
      // Penalización leve para no ganar si hay un número bien extraído.
      score += 2

      if (bestScore === null || score < bestScore) {
        bestScore = score
        bestTotal = c
        bestSource = `computed_${cand.kind}_part_${i + 1}`
        bestRaw = raw
      }
    }
  }

  if (bestTotal > 0) return { total: bestTotal, source: bestSource, chosenTotalsRaw: bestRaw }

  const fallback = pickDeclaredTotal(itemsRaws, sumItems, maxItem)
  return { total: fallback.total, source: fallback.source, chosenTotalsRaw: null }
}

async function openAiChatJson(args: {
  apiKey: string
  model: string
  maxTokens: number
  messages: any[]
  responseFormatJson?: boolean
}) {
  const { apiKey, model, maxTokens, messages, responseFormatJson = true } = args
  const payload: any = {
    model,
    temperature: 0,
    max_tokens: maxTokens,
    messages,
  }
  if (responseFormatJson) payload.response_format = { type: 'json_object' }

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
    const detail = json?.error?.message || json?.message || `OpenAI HTTP ${res.status}`
    // Retry without response_format if server complains
    if (responseFormatJson && res.status === 400 && String(detail).toLowerCase().includes('response_format')) {
      return openAiChatJson({ ...args, responseFormatJson: false })
    }
    throw new Error(detail)
  }
  const content = json?.choices?.[0]?.message?.content
  return parseJsonFromText(content)
}

async function cropBottomJpeg(args: { imageBytes: Buffer; cropHeight: number; maxWidth: number }) {
  const { imageBytes, cropHeight, maxWidth } = args
  let img = sharp(imageBytes, { failOnError: false }).rotate()
  const meta = await img.metadata()
  const w0 = meta.width || 0
  if (maxWidth && w0 && w0 > maxWidth) img = img.resize({ width: maxWidth })
  const resized = await img.jpeg({ quality: 95, mozjpeg: true }).toBuffer()
  const meta2 = await sharp(resized, { failOnError: false }).metadata()
  const w = meta2.width || 0
  const h = meta2.height || 0
  if (!w || !h) return resized
  const hh = Math.min(cropHeight, h)
  const top = Math.max(0, h - hh)
  return sharp(resized, { failOnError: false })
    .extract({ left: 0, top, width: w, height: hh })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()
}

async function splitImagePartsJpeg(args: { imageBytes: Buffer; aggressive: boolean }) {
  const { imageBytes, aggressive } = args
  let img = sharp(imageBytes, { failOnError: false }).rotate()
  const meta = await img.metadata()
  const w0 = meta.width || 0
  const h0 = meta.height || 0
  if (!w0 || !h0) return [await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer()]

  let numParts: number | null = null
  let maxWidth = 0
  if (aggressive) {
    if (h0 > 9000) numParts = 8
    else if (h0 > 7000) numParts = 7
    else if (h0 > 5500) numParts = 6
    else if (h0 > 4200) numParts = 5
    else if (h0 > 3000) numParts = 4
    else if (h0 > 2000) numParts = 3
    else if (h0 > 1200) numParts = 2
    maxWidth = 1700
  } else {
    if (h0 > 9000) numParts = 7
    else if (h0 > 7000) numParts = 6
    else if (h0 > 5200) numParts = 5
    else if (h0 > 3600) numParts = 4
    else if (h0 > 2500) numParts = 3
    else if (h0 > 1700) numParts = 2
    maxWidth = 1400
  }

  if (!numParts) {
    return [await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer()]
  }

  if (maxWidth && w0 > maxWidth) img = img.resize({ width: maxWidth })
  const resized = await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
  const meta2 = await sharp(resized, { failOnError: false }).metadata()
  const w = meta2.width || 0
  const h = meta2.height || 0
  if (!w || !h) return [resized]

  const step = Math.floor(h / numParts)
  const overlap = 260
  const parts: Buffer[] = []
  for (let i = 0; i < numParts; i += 1) {
    const top = Math.max(0, i * step - (i > 0 ? overlap : 0))
    const bottom = i === numParts - 1 ? h : Math.min(h, (i + 1) * step + overlap)
    const height = Math.max(1, bottom - top)
    const buf = await sharp(resized, { failOnError: false })
      .extract({ left: 0, top, width: w, height })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()
    parts.push(buf)
  }
  return parts
}

async function jpegForAi(args: { imageBytes: Buffer; maxWidth: number; quality: number }) {
  const { imageBytes, maxWidth, quality } = args
  let img = sharp(imageBytes, { failOnError: false }).rotate()
  const meta = await img.metadata()
  const w0 = meta.width || 0
  if (maxWidth && w0 && w0 > maxWidth) img = img.resize({ width: maxWidth })
  return img.jpeg({ quality, mozjpeg: true }).toBuffer()
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function sumTaxesFromTotalsRaw(raw: any) {
  let taxTotal = 0
  try {
    for (const t of raw?.taxes || []) taxTotal += parseFloatSafe(t?.amount_raw)
  } catch {
    taxTotal = 0
  }
  return taxTotal
}

function totalsAmountFromTotalsRaw(raw: any): number | null {
  const cents = raw?.declared_total_cents
  if (Number.isInteger(cents) && cents > 0) return cents / 100
  const n = parseFloatSafe(raw?.amount_raw)
  return n > 0 ? n : null
}

function totalsExpectedFromTotalsRaw(raw: any): number | null {
  const subtotal = parseFloatSafe(raw?.subtotal_raw)
  const taxTotal = sumTaxesFromTotalsRaw(raw)
  if (subtotal > 0 && taxTotal > 0) return round2(subtotal + taxTotal)
  return null
}

function totalsLooksPerfect(raw: any) {
  const line = String(raw?.total_line_raw || '')
  const hasKw = /TOTAL|A PAGAR|IMPORTE/i.test(line)
  const amount = totalsAmountFromTotalsRaw(raw)
  const expected = totalsExpectedFromTotalsRaw(raw)
  return !!(hasKw && amount !== null && expected !== null && Math.abs(amount - expected) <= 1)
}

function totalsQualityScore(raw: any) {
  let score = 0
  const line = String(raw?.total_line_raw || '')
  const hasKw = /TOTAL|A PAGAR|IMPORTE/i.test(line)
  const hasDigits = /\d/.test(line)
  const amount = totalsAmountFromTotalsRaw(raw)
  const subtotal = parseFloatSafe(raw?.subtotal_raw)
  const taxTotal = sumTaxesFromTotalsRaw(raw)
  const expected = totalsExpectedFromTotalsRaw(raw)

  if (subtotal > 0) score += 200
  if (taxTotal > 0) score += 30
  if (hasKw) score += 40
  if (hasDigits) score += 10
  if (amount !== null && amount > 0) score += 20
  if (typeof raw?.items_count === 'number' && raw.items_count > 0) score += 10

  if (subtotal > 0 && amount !== null) {
    if (amount < subtotal * 0.6) score -= 200
    if (amount > subtotal * 3) score -= 200
  }

  if (expected !== null && amount !== null) {
    const diff = Math.abs(amount - expected)
    // Penalización fuerte si no cuadra la aritmética.
    score -= Math.min(250, diff * 2)
  }

  return score
}

async function enhanceTotalsCropJpeg(buf: Buffer) {
  return sharp(buf, { failOnError: false })
    .rotate()
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()
}

function totalsApplyVerifiedLines(best: any, verified: any) {
  const lines: string[] = Array.isArray(verified?.lines) ? verified.lines.map((x: any) => String(x || '')).filter(Boolean) : []
  const numbers: string[] = Array.isArray(verified?.numbers) ? verified.numbers.map((x: any) => String(x || '')).filter(Boolean) : []
  if (!lines.length && !numbers.length) return best

  let subtotal: number | null = null
  let iva: number | null = null
  let ieps: number | null = null

  for (const line of lines) {
    const up = line.toUpperCase()
    const n = pickLargestNumberInLine(line)
    if (!(n !== null && n > 0)) continue
    if (up.includes('SUBTOTAL')) subtotal = n
    else if (up.includes('IEPS')) ieps = n
    else if (up.includes('IVA')) iva = n
  }

  const taxSum = (iva || 0) + (ieps || 0)
  const expected = subtotal && taxSum > 0 ? round2(subtotal + taxSum) : null

  // candidatos de total: números listados + números encontrados en líneas
  const candidateNumbers: number[] = []
  for (const s of numbers) {
    const v = parseFloatSafe(s)
    if (v > 0) candidateNumbers.push(v)
  }
  for (const line of lines) {
    const up = line.toUpperCase()
    if (up.includes('TOTAL') && !up.includes('SUBTOTAL')) {
      const v = pickLargestNumberInLine(line)
      if (v !== null && v > 0) candidateNumbers.push(v)
    }
  }

  let chosenTotal: number | null = null
  if (expected !== null && expected > 0 && candidateNumbers.length) {
    let best = candidateNumbers[0]!
    let bestDiff = Math.abs(best - expected)
    for (const c of candidateNumbers) {
      const d = Math.abs(c - expected)
      if (d < bestDiff) {
        best = c
        bestDiff = d
      }
    }
    if (bestDiff <= 1) chosenTotal = best
  }

  // Si no encontramos total explícito, pero sí Subtotal+Impuestos, usamos el esperado.
  if (chosenTotal === null && expected !== null && expected > 0) chosenTotal = expected

  // Actualizar best con lo verificado (solo si tenemos datos).
  if (subtotal !== null && subtotal > 0) best.subtotal_raw = subtotal.toFixed(2)
  if (iva !== null || ieps !== null) {
    best.taxes = [
      { label: 'IVA', amount_raw: iva !== null && iva > 0 ? iva.toFixed(2) : '' },
      { label: 'IEPS', amount_raw: ieps !== null && ieps > 0 ? ieps.toFixed(2) : '' },
    ]
  }
  if (chosenTotal !== null && chosenTotal > 0) {
    best.amount_raw = chosenTotal.toFixed(2)
    // Intentar conservar una línea de total de referencia
    const bestLine =
      lines.find((l) => {
        const up = String(l || '').toUpperCase()
        if (!up.includes('TOTAL') || up.includes('SUBTOTAL')) return false
        const n = pickLargestNumberInLine(l)
        return n !== null && Math.abs(n - chosenTotal) <= 1
      }) || ''
    if (bestLine) best.total_line_raw = bestLine
    best.declared_total_cents = toCents(best.amount_raw)
  }

  best._totals_try = 'verify_lines'
  best._totals_lines = lines.slice(0, 20)
  return best
}

async function extractReceiptFromImagesInternal(args: {
  apiKey: string
  model: string
  images: Buffer[]
  mode?: 'fast' | 'precise'
}): Promise<ReceiptExtractionNormalized> {
  const { apiKey, model } = args
  const images = (Array.isArray(args.images) ? args.images : []).filter((b) => Buffer.isBuffer(b) && b.length > 0)
  if (!images.length) throw new Error('No hay imágenes para extraer')
  const mode = args.mode || 'precise'
  const aggressive = mode === 'precise'

  // 1) Totales (probamos cada foto; normalmente el total está en la última)
  const totalsRaws: any[] = []
  const n = images.length
  const scanOrder = Array.from({ length: n }, (_, i) => i)
  // Preferimos: última, primera, y luego el resto en orden
  scanOrder.sort((a, b) => {
    if (a === n - 1) return -1
    if (b === n - 1) return 1
    if (a === 0) return -1
    if (b === 0) return 1
    return a - b
  })

  const totalsModelFallback = aggressive && model === 'gpt-4o-mini' ? 'gpt-4o' : null

  async function runTotalsExtraction(args2: { modelToUse: string; jpegBytes: Buffer }) {
    const { modelToUse, jpegBytes } = args2
    const totalsBase64 = jpegBytes.toString('base64')
    const totalsRaw = await openAiChatJson({
      apiKey,
      model: modelToUse,
      maxTokens: 900,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT_TOTALS },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${totalsBase64}`, detail: 'high' } },
          ],
        },
      ],
    })
    totalsRaw.declared_total_cents = toCents(totalsRaw.amount_raw)
    return totalsRaw
  }

  async function extractBestTotalsForPhoto(imageBytes: Buffer) {
    const crop = await cropBottomJpeg({ imageBytes, cropHeight: aggressive ? 2300 : 1600, maxWidth: 2000 })
    const enh = aggressive ? await enhanceTotalsCropJpeg(crop) : crop

    const primary = await runTotalsExtraction({ modelToUse: model, jpegBytes: crop })
    primary._totals_try = 'orig'

    let best = primary
    let bestScore = totalsQualityScore(best)

    if (aggressive && !totalsLooksPerfect(best)) {
      const improved = await runTotalsExtraction({ modelToUse: model, jpegBytes: enh })
      improved._totals_try = 'enh'
      const s2 = totalsQualityScore(improved)
      if (s2 > bestScore) {
        best = improved
        bestScore = s2
      }

      if (totalsModelFallback && !totalsLooksPerfect(best)) {
        const upgraded = await runTotalsExtraction({ modelToUse: totalsModelFallback, jpegBytes: enh })
        upgraded._totals_try = `enh_${totalsModelFallback}`
        const s3 = totalsQualityScore(upgraded)
        if (s3 > bestScore) {
          best = upgraded
          bestScore = s3
        }
      }
    }

    // Verificación extra (solo cuando huele a total mal leído):
    // si ya tenemos Subtotal + impuestos, pero el “Total” no cuadra por mucho, pedimos a gpt-4o que liste las líneas exactas.
    try {
      if (aggressive) {
        const amount = totalsAmountFromTotalsRaw(best)
        const expected = totalsExpectedFromTotalsRaw(best)
        const hasKw = /TOTAL|A PAGAR|IMPORTE/i.test(String(best?.total_line_raw || ''))
        if (hasKw && amount !== null && expected !== null && Math.abs(amount - expected) >= 50) {
          const verifyCrop = await cropBottomJpeg({ imageBytes, cropHeight: 1600, maxWidth: 2400 })
          const verifyJpeg = await enhanceTotalsCropJpeg(verifyCrop)
          const verified = await openAiChatJson({
            apiKey,
            model: 'gpt-4o',
            maxTokens: 900,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: PROMPT_TOTALS_LINES },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${verifyJpeg.toString('base64')}`, detail: 'high' } },
                ],
              },
            ],
          })
          best = totalsApplyVerifiedLines(best, verified)
        }
      }
    } catch {
      // best-effort
    }

    return best
  }

  for (const idx of scanOrder) {
    const imageBytes = images[idx]!
    try {
      const totalsRaw = await extractBestTotalsForPhoto(imageBytes)
      totalsRaw._img = idx + 1
      totalsRaws.push(totalsRaw)

      // Early stop: si el total leído cuadra con subtotal+impuestos, es señal muy fuerte.
      if (totalsLooksPerfect(totalsRaw)) break
    } catch (e: any) {
      totalsRaws.push({
        _img: idx + 1,
        error: e?.message || 'No se pudo extraer totales de esta foto',
        amount_raw: '',
        total_line_raw: '',
        currency: 'MXN',
        subtotal_raw: '',
        taxes: [],
        items_count: null,
        items_count_line_raw: '',
        declared_total_cents: 0,
      })
    }
  }

  // 2) Items (si es 1 foto, usamos split; si son varias, tratamos cada foto como parte sin sobre-splitting)
  const partsWithMeta: Array<{ buf: Buffer; img: number }> = []
  if (images.length === 1) {
    const parts = await splitImagePartsJpeg({ imageBytes: images[0]!, aggressive })
    for (const p of parts) partsWithMeta.push({ buf: p, img: 1 })
  } else {
    for (let imgIdx = 0; imgIdx < images.length; imgIdx += 1) {
      const imageBytes = images[imgIdx]!
      let h0 = 0
      try {
        const meta = await sharp(imageBytes, { failOnError: false }).rotate().metadata()
        h0 = meta.height || 0
      } catch {
        h0 = 0
      }

      // Si ya vienen por partes, evitamos dividir de más; solo split si es MUY alta.
      if (h0 > 5200) {
        const sub = await splitImagePartsJpeg({ imageBytes, aggressive: false })
        for (const p of sub) partsWithMeta.push({ buf: p, img: imgIdx + 1 })
      } else {
        const one = await jpegForAi({ imageBytes, maxWidth: 1700, quality: 92 })
        partsWithMeta.push({ buf: one, img: imgIdx + 1 })
      }
    }
  }

  const partsResults = await Promise.all(
    partsWithMeta.map(async ({ buf, img }, idx) => {
      const b64 = buf.toString('base64')
      try {
        const partRaw = await openAiChatJson({
          apiKey,
          model,
          maxTokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT_ITEMS },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: aggressive ? 'high' : 'low' } },
              ],
            },
          ],
        })
        const declared = toCents(partRaw.amount_raw)
        partRaw.declared_total_cents = declared
        const items = Array.isArray(partRaw.items) ? partRaw.items : []
        let sumItems = 0
        for (const it of items) sumItems += toCents(it?.total_raw)
        partRaw.arith_total_cents = sumItems
        partRaw.arith_diff_cents = declared - sumItems
        partRaw._part = idx + 1
        partRaw._img = img
        return partRaw
      } catch (e: any) {
        return {
          _part: idx + 1,
          _img: img,
          error: e?.message || 'No se pudo extraer esta parte',
          items: [
            {
              line_number: 1,
              raw_line: `no legible (parte ${idx + 1} no se pudo extraer)`,
              quantity_raw: '',
              unit_price_raw: '',
              total_raw: 'no legible',
              _system_placeholder: true,
              _line_type: 'placeholder',
            },
          ],
          amount_raw: '',
          currency: 'MXN',
          merchant_or_beneficiary: '',
        }
      }
    })
  )

  const itemsRaws = partsResults

  // Primeros datos
  let firstDate: string | null = null
  let firstTime: string | null = null
  let firstCurrency: string | null = null
  let firstMerchant: string | null = null
  for (const raw of itemsRaws) {
    if (!firstDate && typeof raw?.date === 'string' && raw.date.trim()) firstDate = raw.date.trim()
    if (!firstTime && typeof raw?.time === 'string' && raw.time.trim()) firstTime = raw.time.trim()
    if (!firstCurrency && typeof raw?.currency === 'string' && raw.currency.trim()) firstCurrency = raw.currency.trim()
    if (!firstMerchant && typeof raw?.merchant_or_beneficiary === 'string' && raw.merchant_or_beneficiary.trim()) {
      firstMerchant = raw.merchant_or_beneficiary.trim()
    }
  }
  let currency = (String(totalsRaws?.[0]?.currency || firstCurrency || 'MXN').trim() || 'MXN').toUpperCase()

  const allPartsItems: any[][] = itemsRaws.map((r) => (Array.isArray(r?.items) ? r.items : []))
  const itemsBeforeDedup = allPartsItems.reduce((sum, arr) => sum + arr.length, 0)
  const { merged: combinedItems, removed: dedupRemoved } = mergeItemsWithOverlapDedupe(allPartsItems)

  const sumItemsBefore = combinedItems.reduce((sum, it) => sum + parseFloatSafe(it?.total_raw), 0)
  const maxItem = combinedItems.reduce((m, it) => Math.max(m, parseFloatSafe(it?.total_raw)), 0)

  const picked = pickDeclaredTotalV2({ itemsRaws, totalsRaws, sumItems: sumItemsBefore, maxItem })
  const declaredTotal = picked.total
  const chosenTotalsRaw = picked.chosenTotalsRaw || totalsRaws?.[0] || null
  if (chosenTotalsRaw?.currency) {
    const c = String(chosenTotalsRaw.currency || '').trim()
    if (c) currency = c.toUpperCase()
  }

  // Elegimos el mejor bloque de totales para aritmética (subtotal + impuestos).
  let bestMathRaw: any | null = null
  let bestMathScore: number | null = null
  for (const raw of totalsRaws || []) {
    const subtotal = parseFloatSafe(raw?.subtotal_raw)
    let taxSum = 0
    try {
      for (const t of raw?.taxes || []) taxSum += parseFloatSafe(t?.amount_raw)
    } catch {
      taxSum = 0
    }
    if (!(subtotal > 0) || !(taxSum > 0)) continue
    const expected = subtotal + taxSum
    const hasKw = /TOTAL|A PAGAR|IMPORTE/i.test(String(raw?.total_line_raw || ''))
    const declared = Number.isInteger(raw?.declared_total_cents) && raw.declared_total_cents > 0 ? raw.declared_total_cents / 100 : parseFloatSafe(raw?.amount_raw)

    // Score alto = mejor
    let score = 0
    if (hasKw) score += 50
    if (declared > 0) score += 10
    if (declaredTotal > 0) score -= Math.abs(expected - declaredTotal)
    else if (declared > 0) score -= Math.abs(expected - declared)
    if (sumItemsBefore > 0) score -= Math.abs(expected - sumItemsBefore) * 0.01

    if (bestMathScore === null || score > bestMathScore) {
      bestMathScore = score
      bestMathRaw = raw
    }
  }
  const totalsForMath = bestMathRaw || chosenTotalsRaw

  // Tax total (best effort) — lo calculamos ANTES de reconciliar items para no “meter” impuestos como ajuste.
  let taxTotal = 0
  try {
    for (const t of (totalsForMath?.taxes || []) as any[]) taxTotal += parseFloatSafe(t?.amount_raw)
  } catch {
    taxTotal = 0
  }
  const taxDetected = taxTotal > 0 ? round2(taxTotal) : null

  // Subtotal explícito (si se pudo leer); si no, lo derivamos del total menos impuestos (cuando aplica).
  const subtotalFromTotals = parseFloatSafe(totalsForMath?.subtotal_raw)

  // Tax final: preferimos lo leído (editable por usuario). Solo inferimos si no hay impuestos legibles.
  let taxFinal: number | null = taxDetected
  let taxSource: string | null = taxDetected !== null ? 'sum_taxes' : null
  const taxUsedForMath = taxFinal !== null ? taxFinal : 0

  // Total final (gran total). Si hay Subtotal+Impuestos, lo usamos como “ground truth” para evitar dígitos mal leídos.
  let totalFinal = declaredTotal > 0 ? declaredTotal : 0
  let totalFinalComputed = false
  let totalOverriddenByMath = false
  const expectedTotalFromSubtotalPlusTax =
    subtotalFromTotals > 0 && taxUsedForMath > 0 ? round2(subtotalFromTotals + taxUsedForMath) : null

  if (subtotalFromTotals > 0 && totalFinal > 0 && totalFinal < subtotalFromTotals * 0.6) {
    // Claramente no puede ser el gran total (ej. se confundió con un item).
    totalFinal = 0
  }

  if (expectedTotalFromSubtotalPlusTax !== null) {
    if (!(totalFinal > 0)) {
      totalFinal = expectedTotalFromSubtotalPlusTax
      totalFinalComputed = true
    } else {
      const diff = Math.abs(totalFinal - expectedTotalFromSubtotalPlusTax)
      const impliedTax = subtotalFromTotals > 0 ? round2(totalFinal - subtotalFromTotals) : null
      const taxMismatch = impliedTax !== null && taxUsedForMath > 0 ? Math.abs(impliedTax - taxUsedForMath) : null

      // Solo sobre-escribimos si el total implicaría un impuesto absurdo (p.ej. dígito mal leído en el total).
      const hardMismatch =
        impliedTax !== null &&
        (impliedTax <= 0 || impliedTax > subtotalFromTotals * 0.5 || (taxMismatch !== null && taxMismatch >= 200))

      if (diff >= 5 && hardMismatch) {
        totalFinal = expectedTotalFromSubtotalPlusTax
        totalFinalComputed = true
        totalOverriddenByMath = true
      }
    }
  }

  if (!(totalFinal > 0) && sumItemsBefore > 0 && taxUsedForMath > 0) {
    totalFinal = round2(sumItemsBefore + taxUsedForMath)
    totalFinalComputed = true
  } else if (!(totalFinal > 0)) {
    // Si no se pudo leer total (ni calcular con subtotal+impuestos), NO inventar.
    totalFinal = 0
    totalFinalComputed = false
  }

  totalFinal = round2(totalFinal)
  const chosenAmount = totalFinal > 0 ? totalFinal : null

  function parseLargestIntFromText(text: any): number | null {
    const s = String(text || '')
    const m = s.match(/\d{1,6}/g) || []
    let best = 0
    for (const tok of m) {
      const n = Number.parseInt(tok, 10)
      if (Number.isFinite(n) && n > best) best = n
    }
    return best > 0 ? best : null
  }

  let expectedItemsCount: number | null = null
  let expectedItemsSource: string | null = null
  for (const raw of totalsRaws || []) {
    const direct = Number.isInteger(raw?.items_count) && raw.items_count > 0 ? Number(raw.items_count) : null
    const parsed = parseLargestIntFromText(raw?.items_count_line_raw)
    const v = direct ?? parsed
    if (typeof v === 'number' && v > 0 && (expectedItemsCount === null || v > expectedItemsCount)) {
      expectedItemsCount = v
      expectedItemsSource = direct !== null ? 'items_count' : 'items_count_line_raw'
    }
  }
  const extractedItemsCount = combinedItems.length
  const missingItemsCount =
    typeof expectedItemsCount === 'number' && expectedItemsCount > extractedItemsCount ? expectedItemsCount - extractedItemsCount : null

  const reconcileThreshold = 0.5
  let combinedItemsFinal = [...combinedItems]
  let placeholdersAdded = 0
  let adjustmentAdded: number | null = null
  let sumItemsAfter = sumItemsBefore

  // Target de subtotal: si lo leímos, úsalo; si no, lo derivamos de total-impuestos; si no, usamos suma de items.
  let targetSubtotal = 0
  let targetSubtotalSource: string | null = null
  if (subtotalFromTotals > 0) {
    targetSubtotal = subtotalFromTotals
    targetSubtotalSource = 'totals_subtotal_raw'
  } else if (totalFinal > 0 && taxUsedForMath > 0) {
    targetSubtotal = totalFinal - taxUsedForMath
    targetSubtotalSource = 'derived_total_minus_tax'
  } else {
    targetSubtotal = sumItemsBefore
    targetSubtotalSource = 'items_sum'
  }
  targetSubtotal = Math.round(targetSubtotal * 100) / 100

  const diffSubtotal = targetSubtotal - sumItemsBefore
  const diffTotalMinusSubtotalPlusTax =
    totalFinal > 0 && targetSubtotal > 0 && taxUsedForMath > 0 ? Math.round((totalFinal - (targetSubtotal + taxUsedForMath)) * 100) / 100 : null

  if (typeof missingItemsCount === 'number' && missingItemsCount > 0) {
    const placeholderCap = 10
    const toAdd = Math.min(missingItemsCount, placeholderCap)
    placeholdersAdded = toAdd
    const placeholders = Array.from({ length: toAdd }, (_, i) => ({
      raw_line: 'no legible',
      quantity_raw: '',
      unit_price_raw: '',
      total_raw: 'no legible',
      _system_placeholder: true,
      _line_type: 'placeholder',
      _placeholder_idx: i + 1,
      _placeholder_total: missingItemsCount,
    }))
    combinedItemsFinal = interleavePlaceholdersEvenly(combinedItemsFinal, placeholders)
  }

  // Ajuste solo para “cuadrar subtotal” (no para forzar suma(items) == total con impuestos).
  if (Math.abs(diffSubtotal) >= reconcileThreshold) {
    adjustmentAdded = Math.round(diffSubtotal * 100) / 100
    const label =
      diffSubtotal > 0
        ? typeof missingItemsCount === 'number' && missingItemsCount > 0
          ? `NO LEGIBLE (FALTAN ${missingItemsCount} RENGLONES) — DIFERENCIA PARA CUADRAR SUBTOTAL`
          : 'NO LEGIBLE (DIFERENCIA PARA CUADRAR SUBTOTAL)'
        : 'PROMOCIONES/DESCUENTOS/CANCELACIONES (NO DESGLOSADOS) — AJUSTE PARA CUADRAR SUBTOTAL'
    combinedItemsFinal.push({
      raw_line: label,
      quantity_raw: '',
      unit_price_raw: '',
      total_raw: diffSubtotal.toFixed(2),
      _system_adjustment: true,
      _line_type: 'adjustment',
    })
    sumItemsAfter = sumItemsBefore + diffSubtotal
  }

  const items = combinedItemsFinal.map((it, idx) => {
    const rawLine = typeof it?.raw_line === 'string' ? it.raw_line.trim() : ''
    const quantityRaw = typeof it?.quantity_raw === 'string' ? it.quantity_raw.trim() : ''
    const unitPriceRaw = typeof it?.unit_price_raw === 'string' ? it.unit_price_raw.trim() : ''
    const totalRaw = typeof it?.total_raw === 'string' ? it.total_raw.trim() : ''

    const isAdjustment = !!it?._system_adjustment
    const isPlaceholder = !!it?._system_placeholder
    const amountVal = totalRaw && totalRaw.toLowerCase() !== 'no legible' ? parseFloatSafe(totalRaw) : null
    const qtyVal = quantityRaw && quantityRaw.toLowerCase() !== 'no legible' ? parseFloatSafe(quantityRaw) : null
    const unitPriceVal = unitPriceRaw && unitPriceRaw.toLowerCase() !== 'no legible' ? parseFloatSafe(unitPriceRaw) : null

    const parsedUnit = parseQuantityUnitFromLine(rawLine || '')
    return {
      lineNumber: idx + 1,
      description: rawLine || 'no legible',
      rawLine: rawLine || null,
      quantity: qtyVal,
      unitPrice: unitPriceVal,
      amount: amountVal,
      isAdjustment,
      isPlaceholder,
      lineType: (it?._line_type as string) || (isAdjustment ? 'adjustment' : isPlaceholder ? 'placeholder' : 'item'),
      notes: {
        line_number: idx + 1,
        raw_line: rawLine || 'no legible',
        quantity_raw: quantityRaw,
        unit_price_raw: unitPriceRaw,
        total_raw: totalRaw,
        amount_legible: !!(totalRaw && /\d/.test(totalRaw)),
        is_adjustment: isAdjustment,
        is_placeholder: isPlaceholder,
        placeholder_idx: isPlaceholder ? it?._placeholder_idx ?? null : null,
        placeholder_total: isPlaceholder ? it?._placeholder_total ?? null : null,
      },
      quantityUnit: parsedUnit ? parsedUnit.unit : null,
    }
  })

  const rawText = items
    .map((i) => i.rawLine)
    .filter(Boolean)
    .join('\n')

  const consumption = parseConsumptionFromRawText(rawText || null)

  return {
    merchantName: firstMerchant || null,
    date: firstDate || null,
    time: firstTime || null,
    total: chosenAmount !== null && chosenAmount > 0 ? Math.round(chosenAmount * 100) / 100 : null,
    currency,
    tax: taxFinal,
    tip: null,
    items,
    rawText: rawText || null,
    receiptType: consumption ? 'utility' : 'retail',
    consumptionQuantity: consumption?.consumptionQuantity ?? null,
    consumptionUnit: consumption?.consumptionUnit ?? null,
    consumptionPeriodStart: consumption?.periodStart ?? null,
    consumptionPeriodEnd: consumption?.periodEnd ?? null,
    meta: {
      images_count: images.length,
      totals_photos: totalsRaws.length,
      parts: allPartsItems.length,
      items_before_dedup: itemsBeforeDedup,
      items_after_dedup: combinedItems.length,
      items_after_adjustment: combinedItemsFinal.length,
      dedup_removed: dedupRemoved,
      placeholders_added: placeholdersAdded,
      declared_total: declaredTotal > 0 ? declaredTotal : null,
      total_expected_from_subtotal_plus_tax: expectedTotalFromSubtotalPlusTax,
      total_overridden_by_math: totalOverriddenByMath,
      total_final: chosenAmount,
      total_final_computed: totalFinalComputed,
      tax_total: taxFinal,
      tax_detected: taxDetected,
      tax_source: taxSource,
      subtotal_from_totals: subtotalFromTotals > 0 ? Math.round(subtotalFromTotals * 100) / 100 : null,
      subtotal_target: targetSubtotal > 0 ? targetSubtotal : null,
      subtotal_target_source: targetSubtotalSource,
      sum_items: sumItemsBefore,
      diff_total_minus_items: totalFinal > 0 ? Math.round((totalFinal - sumItemsBefore) * 100) / 100 : null,
      diff_subtotal_minus_items: Math.round((targetSubtotal - sumItemsBefore) * 100) / 100,
      diff_total_minus_subtotal_plus_tax: diffTotalMinusSubtotalPlusTax,
      adjustment_added: adjustmentAdded,
      sum_items_after_adjustment: sumItemsAfter,
      max_item: maxItem,
      total_source: picked.source,
      expected_items_count: expectedItemsCount,
      expected_items_source: expectedItemsSource,
      extracted_items_count: extractedItemsCount,
      missing_items_count: missingItemsCount,
      model,
      mode,
    },
    raw: {
      itemsParts: itemsRaws,
      totalsParts: totalsRaws,
    },
  }
}

export async function extractReceiptFromImageBytes(args: {
  apiKey: string
  model: string
  imageBytes: Buffer
  mode?: 'fast' | 'precise'
}): Promise<ReceiptExtractionNormalized> {
  return extractReceiptFromImagesInternal({ apiKey: args.apiKey, model: args.model, images: [args.imageBytes], mode: args.mode })
}

export async function extractReceiptFromImageParts(args: {
  apiKey: string
  model: string
  imageParts: Buffer[]
  mode?: 'fast' | 'precise'
}): Promise<ReceiptExtractionNormalized> {
  return extractReceiptFromImagesInternal({ apiKey: args.apiKey, model: args.model, images: args.imageParts, mode: args.mode })
}


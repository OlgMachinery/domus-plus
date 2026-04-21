/**
 * Extracción automática de datos en documentos oficiales (identificaciones, actas).
 * Solo para categorías IDENTIFICACIONES y ACTAS; máximo 2 páginas.
 * Procedimiento silencioso: no informa al usuario, solo devuelve datos o null.
 */
import { PDFDocument } from 'pdf-lib'

const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'
const MAX_PAGES_OFFICIAL = 2
/** Máximo píxeles en el lado largo para no exceder límites de la API y mejorar OCR. */
const MAX_IMAGE_DIMENSION = 1536

export type ExtractedOfficialResult = {
  extractedData: Record<string, string>
  expiresAt?: string | null
}

export type ExtractFailureReason = 'pdf_no_pages' | 'openai_error' | 'openai_empty_response' | 'openai_invalid_json'

/**
 * Devuelve el número de páginas de un PDF. Si no es PDF o falla, devuelve 0.
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    return doc.getPageCount()
  } catch {
    return 0
  }
}

/**
 * Convierte las primeras N páginas de un PDF a buffers PNG (para enviar a visión).
 * Acepta Buffer o Uint8Array; prueba con scale 1 y, si falla, con 0.5 (algunos PDFs escaneados).
 */
export async function pdfFirstPagesToImageBuffers(
  buffer: Buffer,
  maxPages: number
): Promise<Buffer[]> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  for (const scale of [1, 0.5]) {
    try {
      const { pdf } = await import('pdf-to-img')
      const doc = await pdf(buf, { scale })
      const out: Buffer[] = []
      let count = 0
      for await (const page of doc) {
        out.push(Buffer.isBuffer(page) ? page : Buffer.from(page))
        count++
        if (count >= maxPages) break
      }
      if (out.length > 0) return out
    } catch (e) {
      if (scale === 0.5) {
        console.warn('[extract-official] pdfFirstPagesToImageBuffers failed:', (e as Error)?.message || e)
      }
    }
  }
  return []
}

/**
 * Redimensiona una imagen (PNG/JPEG) para que el lado largo no supere maxDim.
 * Devuelve el buffer original si no hace falta redimensionar o si sharp falla.
 */
async function resizeImageIfNeeded(buffer: Buffer, mime: string, maxDim: number = MAX_IMAGE_DIMENSION): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(buffer).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w <= maxDim && h <= maxDim) return buffer
    const scale = maxDim / Math.max(w, h)
    const out = await sharp(buffer)
      .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'inside' })
      .png()
      .toBuffer()
    return out
  } catch {
    return buffer
  }
}

/**
 * Llama a OpenAI Vision para extraer datos estructurados de una imagen de documento oficial.
 * Devuelve JSON con campos ordenados (nombre, número, fecha de vencimiento, etc.) o null.
 */
type ExtractImageResult = { result: ExtractedOfficialResult } | { result: null; reason: ExtractFailureReason }

async function extractFromImageBase64(
  imageBase64: string,
  mime: string,
  category: 'IDENTIFICACIONES' | 'ACTAS'
): Promise<ExtractImageResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { result: null, reason: 'openai_error' }

  const typeHint = category === 'IDENTIFICACIONES'
    ? 'identificación oficial (INE, IFE, licencia, pasaporte, credencial).'
    : 'acta oficial (nacimiento, matrimonio, defunción, etc.).'

  const prompt = `Esta imagen es un documento oficial: ${typeHint}

Extrae TODOS los datos legibles. Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, sin markdown.

Usa exactamente estas claves en español (las que apliquen y estén visibles):
- "Nombre" (nombre completo)
- "Número" o "Número de credencial"
- "Clave de elector"
- "CURP"
- "Fecha de nacimiento"
- "Fecha de vencimiento" (en formato YYYY-MM-DD si es posible)
- "Domicilio" o "Dirección"
- "Sexo"
- "Sección"
- "Anio de registro" o "Año de registro"

Ejemplo: {"Nombre": "Juan Pérez García", "Número": "123456789012", "Clave de elector": "ABCD123456...", "CURP": "...", "Fecha de vencimiento": "2030-01-15", "Domicilio": "Calle..."}`

  const imagePart = {
    type: 'image_url' as const,
    image_url: {
      url: `data:${mime};base64,${imageBase64}`,
      detail: 'high' as const,
    },
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: prompt },
              imagePart,
            ],
          },
        ],
      }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('[extract-official] OpenAI Vision error:', res.status, json?.error?.message)
      return { result: null, reason: 'openai_error' }
    }
    const content = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : ''
    if (!content) {
      console.warn('[extract-official] OpenAI returned empty content')
      return { result: null, reason: 'openai_empty_response' }
    }
    const cleaned = content.replace(/^```\w*\n?|```$/g, '').trim()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
        } catch {
          console.warn('[extract-official] OpenAI response is not valid JSON. First 200 chars:', cleaned.slice(0, 200))
        }
      }
    }
    if (!parsed || typeof parsed !== 'object') return { result: null, reason: 'openai_invalid_json' }

    const keyAliases: Record<string, string> = {
      nombre: 'Nombre',
      numero: 'Número',
      'número': 'Número',
      'numero de credencial': 'Número',
      'número de credencial': 'Número',
      'clave de elector': 'Clave de elector',
      curp: 'CURP',
      'fecha de nacimiento': 'Fecha de nacimiento',
      'fecha de vencimiento': 'Fecha de vencimiento',
      vigencia: 'Fecha de vencimiento',
      domicilio: 'Domicilio',
      direccion: 'Domicilio',
      dirección: 'Domicilio',
      sexo: 'Sexo',
      seccion: 'Sección',
      sección: 'Sección',
    }
    const extractedData: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || v == null) continue
      const str = typeof v === 'string' ? v.trim() : typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
      if (!str) continue
      const keyNorm = k.trim().toLowerCase()
      const canonicalKey = keyAliases[keyNorm] || (k.trim().charAt(0).toUpperCase() + k.trim().slice(1).toLowerCase())
      extractedData[canonicalKey] = str
    }
    if (Object.keys(extractedData).length === 0) return { result: null, reason: 'openai_empty_response' }

    let expiresAt: string | null = null
    const expiryKeys = ['Fecha de vencimiento', 'Fecha de vigencia', 'Vigencia', 'Vencimiento', 'expiresAt', 'fechaVencimiento']
    for (const key of expiryKeys) {
      const val = extractedData[key]
      if (val) {
        const date = parseDateToISO(val)
        if (date) {
          expiresAt = date
          break
        }
      }
    }

    return { result: { extractedData, expiresAt } }
  } catch (e) {
    console.warn('[extract-official] extractFromImageBase64 error:', (e as Error)?.message || e)
    return { result: null, reason: 'openai_error' }
  }
}

export type ExtractResult = { result: ExtractedOfficialResult; reason?: null } | { result: null; reason: ExtractFailureReason }

function parseDateToISO(val: string): string | null {
  const s = val.trim()
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(s)
  if (iso) return iso[0]!
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

/**
 * Extrae datos de un documento oficial (solo IDENTIFICACIONES o ACTAS).
 * - Imagen: una página, se envía a visión.
 * - PDF: máximo 2 páginas; se convierten a imágenes y se envían (primera página como base, segunda se fusiona en el JSON si hay más datos).
 * Si falla, devuelve { result: null, reason } para que la API pueda mostrar un mensaje más específico.
 */
export async function extractOfficialDocumentData(
  fileBuffer: Buffer,
  mime: string,
  category: 'IDENTIFICACIONES' | 'ACTAS'
): Promise<ExtractResult> {
  const mimeLower = (mime || '').toLowerCase()
  try {
    if (mimeLower.startsWith('image/')) {
      const resized = await resizeImageIfNeeded(fileBuffer, mime)
      const base64 = resized.toString('base64')
      const mimeToSend = resized === fileBuffer ? mime : 'image/png'
      const out = await extractFromImageBase64(base64, mimeToSend, category)
      return out.result ? { result: out.result } : { result: null, reason: out.reason }
    }
    if (mimeLower === 'application/pdf') {
      const pages = await pdfFirstPagesToImageBuffers(fileBuffer, MAX_PAGES_OFFICIAL)
      if (pages.length === 0) {
        console.warn('[extract-official] PDF produced 0 image pages')
        return { result: null, reason: 'pdf_no_pages' }
      }
      const page0 = await resizeImageIfNeeded(pages[0], 'image/png')
      const firstOut = await extractFromImageBase64(page0.toString('base64'), 'image/png', category)
      const first = firstOut.result
      if (pages.length === 1) return first ? { result: first } : { result: null, reason: firstOut.reason }
      const page1 = await resizeImageIfNeeded(pages[1], 'image/png')
      const secondOut = await extractFromImageBase64(page1.toString('base64'), 'image/png', category)
      const second = secondOut.result
      if (!first && !second) return { result: null, reason: firstOut.reason || secondOut.reason || 'openai_empty_response' }
      const mergedData: Record<string, string> = { ...(first?.extractedData || {}), ...(second?.extractedData || {}) }
      const expiresAt = first?.expiresAt || second?.expiresAt || null
      return { result: { extractedData: mergedData, expiresAt } }
    }
  } catch (e) {
    console.warn('[extract-official] extractOfficialDocumentData error:', (e as Error)?.message || e)
  }
  return { result: null, reason: 'openai_error' }
}

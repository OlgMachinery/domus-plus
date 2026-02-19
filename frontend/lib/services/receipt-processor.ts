/**
 * Servicio para procesar recibos con OCR usando OpenAI
 * Requiere: npm install openai
 */

const PROMPT_UNIVERSAL = `MODO EXTRACCIÓN FISCAL UNIVERSAL (tickets, facturas, recibos).

Devuelve EXCLUSIVAMENTE JSON válido.
No incluyas texto antes ni después del JSON.
No calcules ni deduzcas; copia EXACTO lo impreso.

Formato de salida:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount_raw": "texto tal cual del total impreso",
  "currency": "MXN",
  "merchant_or_beneficiary": "texto impreso",
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

Reglas:
- Cada renglón impreso que represente un concepto = 1 item.
- Usa raw_line con el texto completo del renglón.
- No normalices, no completes campos faltantes. Si no aparece cantidad/precio/total, deja "".
- No incluyas subtotales, impuestos, promociones ni totales como items.
- Usa el total impreso del documento en amount_raw (sin calcular).`

function getOpenAIClient() {
  try {
    const OpenAI = require('openai')
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return null
    }
    
    return new OpenAI({ apiKey })
  } catch (error) {
    console.error('OpenAI no disponible:', error)
    return null
  }
}

function extractJSON(content: string): any {
  let text = content.trim()
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    if (lines[0].startsWith('```')) {
      lines.shift()
    }
    if (lines[lines.length - 1].trim() === '```') {
      lines.pop()
    }
    text = lines.join('\n')
  }
  if (text.includes('{') && text.includes('}')) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      text = text.substring(start, end + 1)
    }
  }
  return JSON.parse(text)
}

function toCents(value: string | null | undefined): number {
  if (!value) return 0
  const cleaned = value.toString().replace(/[^0-9.-]/g, '')
  if (!cleaned) return 0
  try {
    const num = parseFloat(cleaned)
    return Math.round(num * 100)
  } catch {
    return 0
  }
}

export async function processReceiptImage(
  imageBase64: string,
  imageFormat: string = 'jpeg'
): Promise<any> {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error('OpenAI API key no configurada o cliente no disponible.')
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT_UNIVERSAL },
            {
              type: 'image_url',
              image_url: { url: `data:image/${imageFormat};base64,${imageBase64}` },
            },
          ],
        },
      ],
    })

    const content = response.choices[0].message.content || ''
    const data = extractJSON(content)

    if (!data.items || !Array.isArray(data.items)) {
      data.items = []
    }

    // Validación aritmética
    const declaredTotalCents = toCents(data.amount_raw)
    const sumItemsCents = data.items.reduce((sum: number, it: any) => sum + toCents(it.total_raw), 0)
    
    data.arith_total_cents = sumItemsCents
    data.declared_total_cents = declaredTotalCents
    data.arith_diff_cents = declaredTotalCents - sumItemsCents

    return data
  } catch (error: any) {
    throw new Error(`Error procesando el recibo: ${error.message}`)
  }
}

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ReceiptData {
  date: string
  time: string
  amount: number
  amount_raw?: string
  currency: string
  merchant_or_beneficiary?: string
  category?: string
  subcategory?: string
  concept?: string
  reference?: string
  operation_id?: string
  tracking_key?: string
  notes?: string
  items?: ReceiptItem[]
}

export interface ReceiptItem {
  raw_line: string
  quantity_raw?: string
  unit_price_raw?: string
  total_raw?: string
}

const SYSTEM_PROMPT = `You are a receipt data extraction assistant. Extract information from receipt images and return structured JSON data.

For each receipt, extract:
- date: Date in YYYY-MM-DD format
- time: Time in HH:MM format (24h)
- amount: Total amount as a number
- amount_raw: Original amount string from receipt
- currency: Currency code (default MXN)
- merchant_or_beneficiary: Store/merchant name
- category: Category (e.g., ALIMENTACION, TRANSPORTE, SERVICIOS, SALUD, EDUCACION, ENTRETENIMIENTO, HOGAR, OTROS)
- subcategory: Subcategory based on the merchant/items
- concept: Brief description of the purchase
- reference: Receipt/ticket number if visible
- operation_id: Operation ID if visible
- tracking_key: Tracking key if visible (for bank transfers)
- items: Array of line items with raw_line, quantity_raw, unit_price_raw, total_raw

Return ONLY valid JSON, no markdown or explanations.`

export async function processReceiptImage(
  imageBase64: string,
  imageFormat: string = 'jpeg'
): Promise<ReceiptData | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/${imageFormat};base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: 'Extract all data from this receipt image. Return JSON only.',
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('No content in OpenAI response')
      return null
    }

    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }

    const data = JSON.parse(jsonStr.trim()) as ReceiptData

    if (!data.date) {
      const now = new Date()
      data.date = now.toISOString().split('T')[0]
    }
    if (!data.time) {
      const now = new Date()
      data.time = now.toTimeString().slice(0, 5)
    }
    if (!data.currency) {
      data.currency = 'MXN'
    }
    if (typeof data.amount !== 'number') {
      data.amount = parseFloat(String(data.amount).replace(/[^0-9.-]/g, '')) || 0
    }

    return data
  } catch (error) {
    console.error('Error processing receipt with OpenAI:', error)
    return null
  }
}

export async function processReceiptImageRaw(
  imageBase64: string,
  imageFormat: string = 'jpeg'
): Promise<ReceiptData | null> {
  return processReceiptImage(imageBase64, imageFormat)
}

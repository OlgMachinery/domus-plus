import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!

function normalizePhone(phone: string): string {
  let normalized = phone.replace('whatsapp:', '').trim()
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('52')) {
      normalized = '+' + normalized
    } else if (normalized.length === 10) {
      normalized = '+52' + normalized
    }
  }
  if (normalized.startsWith('+521') && normalized.length >= 14) {
    normalized = '+52' + normalized.slice(4)
  }
  return normalized
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''
    const mediaUrl0 = formData.get('MediaUrl0')?.toString()
    const mediaContentType0 = formData.get('MediaContentType0')?.toString()

    console.log(`📱 WhatsApp message from: ${from}`)
    console.log(`📨 MessageSid: ${messageSid}`)

    const phone = normalizePhone(from)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('whatsapp_message_id', messageSid)
      .single()

    if (existingTx) {
      console.log(`⚠️ Duplicate message detected: ${messageSid}`)
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      })
    }

    let user = await findUserByPhone(supabase, phone)

    if (!user) {
      console.log(`❌ User not found for phone: ${phone}`)
      const errorMsg = `❌ You are not registered in DOMUS+ with number ${phone}.\n\nPlease register first in the web application.`
      return createTwiMLResponse(errorMsg)
    }

    console.log(`✅ User found: ${user.name} (${user.email})`)

    if (!mediaUrl0) {
      return createTwiMLResponse('📸 Please send a receipt image to process.')
    }

    const isImage = mediaContentType0?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => mediaUrl0.toLowerCase().includes(ext))

    if (!isImage) {
      return createTwiMLResponse('❌ Only receipt images are supported. Please send a photo.')
    }

    let imageData: Buffer
    try {
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN

      const headers: Record<string, string> = {}
      if (twilioAccountSid && twilioAuthToken) {
        const credentials = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
      }

      const mediaResponse = await fetch(mediaUrl0, { headers })
      if (!mediaResponse.ok) {
        throw new Error(`Failed to download image: ${mediaResponse.status}`)
      }
      imageData = Buffer.from(await mediaResponse.arrayBuffer())
      console.log(`📥 Image downloaded: ${imageData.length} bytes`)
    } catch (error) {
      console.error('Error downloading image:', error)
      return createTwiMLResponse('❌ Could not download the image. Please try again.')
    }

    let imageFormat = 'jpeg'
    if (imageData.slice(0, 8).toString('hex').startsWith('89504e47')) {
      imageFormat = 'png'
    }

    const imageBase64 = imageData.toString('base64')

    let receiptData
    try {
      receiptData = await processReceiptWithOpenAI(imageBase64, imageFormat)
    } catch (error) {
      console.error('Error processing receipt:', error)
      return createTwiMLResponse('❌ Could not process the receipt. Please try with a clearer image.')
    }

    if (!receiptData) {
      return createTwiMLResponse('❌ Could not extract data from the image. Please try with a clearer receipt.')
    }

    let transactionDate = new Date()
    if (receiptData.date) {
      try {
        const dateStr = receiptData.time
          ? `${receiptData.date}T${receiptData.time}`
          : receiptData.date
        transactionDate = new Date(dateStr)
      } catch {
        transactionDate = new Date()
      }
    }

    let familyBudget = null
    if (user.family_id && receiptData.category) {
      const { data: budget } = await supabase
        .from('family_budgets')
        .select('id')
        .eq('family_id', user.family_id)
        .eq('category', receiptData.category)
        .maybeSingle()
      familyBudget = budget
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        family_budget_id: familyBudget?.id || null,
        date: transactionDate.toISOString(),
        amount: receiptData.amount || 0,
        transaction_type: 'expense',
        currency: receiptData.currency || 'MXN',
        merchant_or_beneficiary: receiptData.merchant_or_beneficiary,
        category: receiptData.category,
        subcategory: receiptData.subcategory,
        concept: receiptData.concept,
        reference: receiptData.reference,
        operation_id: receiptData.operation_id,
        tracking_key: receiptData.tracking_key,
        notes: receiptData.notes,
        receipt_image_url: mediaUrl0,
        whatsapp_message_id: messageSid,
        whatsapp_phone: phone,
        status: 'processed',
      })
      .select()
      .single()

    if (txError) {
      console.error('Error creating transaction:', txError)
      return createTwiMLResponse('❌ Error saving the transaction. Please try again.')
    }

    if (familyBudget) {
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('id, spent_amount')
        .eq('user_id', user.id)
        .eq('family_budget_id', familyBudget.id)
        .single()

      if (userBudget) {
        await supabase
          .from('user_budgets')
          .update({ spent_amount: (userBudget.spent_amount || 0) + receiptData.amount })
          .eq('id', userBudget.id)
      }
    }

    console.log(`✅ Transaction created: ${transaction.id}`)

    let confirmationMsg = `✅ Receipt processed!\n\n`
    confirmationMsg += `💰 Amount: $${receiptData.amount?.toLocaleString()} ${receiptData.currency || 'MXN'}\n`
    if (receiptData.category) confirmationMsg += `🏷️ Category: ${receiptData.category}\n`
    if (receiptData.merchant_or_beneficiary) confirmationMsg += `🏪 Merchant: ${receiptData.merchant_or_beneficiary}\n`
    if (receiptData.date) confirmationMsg += `📅 Date: ${receiptData.date}\n`
    confirmationMsg += `\n📊 View details in the DOMUS+ app.`

    return createTwiMLResponse(confirmationMsg)
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return createTwiMLResponse('❌ An error occurred. Please try again later.')
  }
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook is active' })
}

function createTwiMLResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function findUserByPhone(supabase: import('@supabase/supabase-js').SupabaseClient, phone: string) {
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (!user && phone.startsWith('+')) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone.slice(1))
      .single()
    user = data
  }

  if (!user) {
    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length >= 10) {
      const lastDigits = digitsOnly.slice(-10)
      const { data } = await supabase
        .from('users')
        .select('*')
        .like('phone', `%${lastDigits}`)
        .single()
      user = data
    }
  }

  return user
}

async function processReceiptWithOpenAI(imageBase64: string, imageFormat: string) {
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extract receipt data and return JSON only:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount": 123.45,
  "currency": "MXN",
  "merchant_or_beneficiary": "Store Name",
  "category": "ALIMENTACION|TRANSPORTE|SERVICIOS|SALUD|EDUCACION|ENTRETENIMIENTO|HOGAR|OTROS",
  "subcategory": "subcategory",
  "concept": "brief description",
  "reference": "receipt number",
  "operation_id": "operation id",
  "tracking_key": "tracking key",
  "notes": "additional notes"
}`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract data from this receipt:' },
          {
            type: 'image_url',
            image_url: { url: `data:image/${imageFormat};base64,${imageBase64}` }
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0.1,
  })

  const content = response.choices[0]?.message?.content
  if (!content) return null

  let jsonStr = content.trim()
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7)
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3)
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3)

  return JSON.parse(jsonStr.trim())
}

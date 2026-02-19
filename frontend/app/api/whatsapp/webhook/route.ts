import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Obtener datos del form (Twilio envía form-data)
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string | null
    const mediaUrl0 = formData.get('MediaUrl0') as string | null
    const messageSid = formData.get('MessageSid') as string

    if (!from || !messageSid) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error: Faltan parámetros requeridos</Message></Response>',
        {
          status: 400,
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        }
      )
    }

    // Normalizar número de teléfono
    let phone = from.replace('whatsapp:', '').trim()
    if (!phone.startsWith('+')) {
      if (phone.startsWith('52')) {
        phone = '+' + phone
      } else if (phone.length === 10) {
        phone = '+52' + phone
      }
    }

    // Corregir formato de Twilio para México (+521 -> +52)
    if (phone.startsWith('+521') && phone.length >= 14) {
      phone = '+52' + phone.substring(4)
    }

    console.log(`📱 Recibiendo mensaje de WhatsApp desde: ${phone}`)
    console.log(`📨 MessageSid: ${messageSid}`)

    // Verificar si el mensaje ya fue procesado
    const supabase = await createClient(request)
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('whatsapp_message_id', messageSid)
      .single()

    if (existingTransaction) {
      console.log(`⚠️ Mensaje duplicado detectado (MessageSid: ${messageSid})`)
      // Retornar respuesta vacía para evitar que Twilio reenvíe
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        }
      )
    }

    // Buscar usuario por teléfono
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .or(`phone.eq.${phone},phone.eq.${phone.substring(1)},phone.eq.+${phone}`)
      .single()

    if (!user) {
      console.log(`❌ Usuario no encontrado para el número: ${phone}`)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ No estás registrado en el sistema. Contacta al administrador.</Message></Response>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        }
      )
    }

    // Si hay imagen, procesarla como recibo
    if (mediaUrl0) {
      console.log(`📷 Procesando imagen de recibo: ${mediaUrl0}`)
      
      try {
        // Descargar imagen desde Twilio
        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const authToken = process.env.TWILIO_AUTH_TOKEN
        
        if (!accountSid || !authToken) {
          console.error('Twilio no configurado')
          return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Servicio no configurado. Contacta al administrador.</Message></Response>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            }
          )
        }

        // Descargar imagen
        const mediaResponse = await fetch(mediaUrl0, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
        })
        
        if (!mediaResponse.ok) {
          throw new Error('Error descargando imagen de Twilio')
        }
        
        const imageBuffer = Buffer.from(await mediaResponse.arrayBuffer())
        const imageBase64 = imageBuffer.toString('base64')
        
        // Procesar con OpenAI
        const { processReceiptImage } = await import('@/lib/services/receipt-processor')
        const receiptData = await processReceiptImage(imageBase64, 'jpeg')
        
        // Calcular monto total
        const declaredTotal = parseFloat(receiptData.amount_raw?.replace(/[^0-9.-]/g, '') || '0')
        const sumItems = (receiptData.items || []).reduce((sum: number, it: any) => {
          const total = parseFloat(it.total_raw?.replace(/[^0-9.-]/g, '') || '0')
          return sum + total
        }, 0)
        const chosenAmount = declaredTotal > 0 ? declaredTotal : sumItems
        
        // Crear recibo
        const { data: receipt, error: receiptError } = await supabase
          .from('receipts')
          .insert({
            user_id: user.id,
            image_url: mediaUrl0,
            date: receiptData.date || new Date().toISOString().split('T')[0],
            time: receiptData.time || null,
            amount: chosenAmount,
            currency: receiptData.currency || 'MXN',
            merchant_or_beneficiary: receiptData.merchant_or_beneficiary || null,
            status: 'pending',
            whatsapp_message_id: messageSid,
            notes: JSON.stringify({ raw_receipt: receiptData }),
          })
          .select()
          .single()

        if (receiptError) {
          console.error('Error creando recibo:', receiptError)
          return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error al procesar el recibo. Intenta más tarde.</Message></Response>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            }
          )
        }
        
        // Crear items del recibo
        if (receiptData.items && receiptData.items.length > 0) {
          const receiptItems = receiptData.items.map((item: any, idx: number) => ({
            receipt_id: receipt.id,
            description: item.raw_line || `Item ${idx + 1}`,
            amount: parseFloat(item.total_raw?.replace(/[^0-9.-]/g, '') || '0'),
            quantity: item.quantity_raw ? parseFloat(item.quantity_raw.replace(/[^0-9.-]/g, '')) : null,
            unit_price: item.unit_price_raw ? parseFloat(item.unit_price_raw.replace(/[^0-9.-]/g, '')) : null,
            notes: `line_number: ${idx + 1}`,
          }))
          
          await supabase
            .from('receipt_items')
            .insert(receiptItems)
        }

        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>✅ Recibo procesado exitosamente. Se extrajeron ' + (receiptData.items?.length || 0) + ' items.</Message></Response>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          }
        )
      } catch (error: any) {
        console.error('Error procesando recibo de WhatsApp:', error)
        
        // Si OpenAI no está disponible, crear recibo básico
        if (error.message?.includes('OpenAI') || error.message?.includes('MODULE_NOT_FOUND')) {
          const { data: receipt } = await supabase
            .from('receipts')
            .insert({
              user_id: user.id,
              image_url: mediaUrl0,
              status: 'pending',
              whatsapp_message_id: messageSid,
            })
            .select()
            .single()
          
          return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Message>✅ Recibo recibido. Se procesará manualmente.</Message></Response>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            }
          )
        }
        
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error al procesar el recibo. Intenta más tarde.</Message></Response>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          }
        )
      }
    }

    // Si es solo texto, responder
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>📸 Envía una foto de tu recibo para procesarlo automáticamente.</Message></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      }
    )
  } catch (error: any) {
    console.error('Error en POST /api/whatsapp/webhook:', error)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>❌ Error al procesar el mensaje. Intenta más tarde.</Message></Response>',
      {
        status: 500,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      }
    )
  }
}

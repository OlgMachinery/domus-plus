/**
 * Servicio para WhatsApp usando Twilio
 * Requiere: npm install twilio
 */

function getTwilioClient() {
  try {
    const twilio = require('twilio')
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    
    if (!accountSid || !authToken) {
      return null
    }
    
    return twilio(accountSid, authToken)
  } catch (error) {
    console.error('Twilio no disponible:', error)
    return null
  }
}

export function sendWhatsAppMessage(to: string, message: string): boolean {
  const client = getTwilioClient()
  if (!client) {
    console.log('Twilio no configurado')
    return false
  }

  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER
  if (!whatsappNumber) {
    console.log('TWILIO_WHATSAPP_NUMBER no configurado')
    return false
  }

  try {
    client.messages.create({
      body: message,
      from: whatsappNumber,
      to: `whatsapp:${to}`,
    })
    return true
  } catch (error: any) {
    console.error(`Error enviando mensaje WhatsApp: ${error.message}`)
    return false
  }
}

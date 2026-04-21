/**
 * Helpers para webhook WhatsApp (Twilio): normalizar teléfono, buscar usuario, TwiML, enviar mensaje.
 */

import { prisma } from '@/lib/db/prisma'

/** URL base de la app Domus (para enlaces en mensajes y recibos). */
export const DOMUS_APP_URL = process.env.DOMUS_APP_URL || process.env.NEXTAUTH_URL || 'https://domus-fam.com'

/** Sufijo corto para mensajes WhatsApp: "D+" + link. Añadir al final del cuerpo para que el enlace sea clickeable. */
export function getDomusLinkSuffix(): string {
  return `\n\nD+ ${DOMUS_APP_URL}`
}

export function normalizePhone(phone: string): string {
  let n = String(phone || '').replace(/whatsapp:/gi, '').trim()
  if (!n) return ''
  if (!n.startsWith('+')) {
    if (n.startsWith('52') && n.length >= 12) n = '+' + n
    else if (n.length === 10) n = '+52' + n
    else if (n.length === 12 && n.startsWith('52')) n = '+' + n
  }
  if (n.startsWith('+521') && n.length >= 14) n = '+52' + n.slice(4)
  return n
}

/** E.164 para México móvil: +521 + 10 dígitos. Usar al guardar teléfono para que Twilio WhatsApp funcione. */
export function normalizePhoneForStorage(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10 && !digits.startsWith('52')) return '+521' + digits
  if (digits.length === 12 && digits.startsWith('52')) return '+521' + digits.slice(2)
  if (digits.length === 13 && digits.startsWith('521')) return '+' + digits
  if (phone.startsWith('+') && digits.length >= 12) return '+' + (digits.startsWith('521') ? digits : '521' + digits.replace(/^52/, ''))
  return phone.trim() || ''
}

export async function findUserByPhone(phone: string): Promise<{
  id: string
  name: string | null
  email: string
  phone: string | null
} | null> {
  if (!phone) return null
  const normalized = normalizePhone(phone)
  let user = await prisma.user.findFirst({
    where: { phone: normalized },
    select: { id: true, name: true, email: true, phone: true },
  })
  if (!user && normalized.startsWith('+')) {
    user = await prisma.user.findFirst({
      where: { phone: normalized.slice(1) },
      select: { id: true, name: true, email: true, phone: true },
    })
  }
  if (!user && /^\d{10}$/.test(normalized.replace(/\D/g, '').slice(-10))) {
    const last10 = normalized.replace(/\D/g, '').slice(-10)
    const all = await prisma.user.findMany({ where: { phone: { not: null } }, select: { id: true, name: true, email: true, phone: true } })
    const match = all.find((u) => u.phone && u.phone.replace(/\D/g, '').endsWith(last10))
    if (match) user = match
  }
  return user
}

function escapeTwiML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function createTwiMLResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeTwiML(message)}</Message></Response>`
  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

/** TwiML con varios mensajes: Twilio los envía en orden (2/2, 3/3, etc.). */
export function createTwiMLResponseMultiple(messages: string[]): Response {
  const parts = messages.filter(Boolean).map((m) => `<Message>${escapeTwiML(m)}</Message>`)
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${parts.join('')}</Response>`
  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}

/**
 * Formato E.164 para Twilio WhatsApp: México móvil usa 52 + 1 + 10 dígitos (ej. 5218126333310).
 * Acepta: 10 dígitos (8126333310), +52 81..., +52812..., +521812...
 */
function toTwilioWhatsAppNumber(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  // 10 dígitos (ej. 8126333310) → México móvil 521 + 10
  if (digits.length === 10 && !digits.startsWith('52')) digits = '521' + digits
  // 52 + 10 (sin 1 de móvil) → añadir 1
  else if (digits.startsWith('52') && digits.length === 12) digits = '521' + digits.slice(2)
  // 52 + 1 + 10 = 13 dígitos → ya está bien
  else if (digits.startsWith('521') && digits.length === 13) { /* ok */ }
  // Cualquier otro con 52 al inicio: asegurar 521 + 10
  else if (digits.startsWith('52') && digits.length === 11) digits = '521' + digits.slice(2)
  if (digits.length < 13 || !digits.startsWith('521')) return ''
  return `whatsapp:${digits}`
}

export type SendWhatsAppResult = { ok: true } | { ok: false; error: string }

export type SendWhatsAppWithSidResult = { ok: true; sid: string } | { ok: false; error: string }

async function sendWhatsAppRaw(
  toPhone: string,
  body: string,
): Promise<{ ok: true; data: { sid?: string } } | { ok: false; error: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER
  if (!accountSid || !authToken || !fromNumber) return { ok: false, error: 'Faltan variables TWILIO_* en el servidor' }
  const to = toTwilioWhatsAppNumber(toPhone)
  if (!to) return { ok: false, error: 'Número de teléfono inválido' }
  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber.replace(/^\+/, '').replace(/\D/g, '')}`
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    const text = await r.text()
    if (!r.ok) {
      let err = `HTTP ${r.status}`
      try {
        const j = JSON.parse(text)
        if (j.message) err = j.message
        if (j.code) err = `${j.code}: ${err}`
      } catch {
        if (text) err = text.slice(0, 200)
      }
      return { ok: false, error: err }
    }
    let data: { sid?: string } = {}
    try {
      data = JSON.parse(text)
    } catch {
      // ignore
    }
    return { ok: true, data }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error de red al conectar con Twilio' }
  }
}

export function sendWhatsAppMessage(toPhone: string, body: string): Promise<SendWhatsAppResult> {
  return sendWhatsAppRaw(toPhone, body).then((res) =>
    res.ok ? { ok: true as const } : { ok: false, error: res.error },
  )
}

/** Envía mensaje y devuelve el SID del mensaje (para vincular respuestas). */
export function sendWhatsAppMessageAndGetSid(toPhone: string, body: string): Promise<SendWhatsAppWithSidResult> {
  return sendWhatsAppRaw(toPhone, body).then((res) => {
    if (!res.ok) return { ok: false, error: res.error }
    const sid = res.data?.sid && typeof res.data.sid === 'string' ? res.data.sid : null
    if (!sid) return { ok: false, error: 'Twilio no devolvió SID del mensaje' }
    return { ok: true, sid }
  })
}

/**
 * Envía un mensaje con documento o imagen (MediaUrl). Para comprobantes en PDF o tarjetas en imagen.
 * La URL debe ser pública (Twilio descarga desde ahí). Máx 16 MB en WhatsApp.
 */
export function sendWhatsAppWithMedia(
  toPhone: string,
  mediaUrl: string,
  options?: { body?: string },
): Promise<SendWhatsAppResult> {
  return sendWhatsAppWithMediaRaw(toPhone, mediaUrl, options).then((res) =>
    res.ok ? { ok: true as const } : { ok: false, error: res.error },
  )
}

/** Envía mensaje con media (imagen/ticket o PDF) y devuelve el SID para vincular respuestas. */
export function sendWhatsAppWithMediaAndGetSid(
  toPhone: string,
  mediaUrl: string,
  options?: { body?: string },
): Promise<SendWhatsAppWithSidResult> {
  return sendWhatsAppWithMediaRaw(toPhone, mediaUrl, options).then((res) => {
    if (!res.ok) return { ok: false, error: res.error }
    const sid = res.sid
    if (!sid) return { ok: false, error: 'Twilio no devolvió SID del mensaje' }
    return { ok: true, sid }
  })
}

async function sendWhatsAppWithMediaRaw(
  toPhone: string,
  mediaUrl: string,
  options?: { body?: string },
): Promise<{ ok: true; sid?: string } | { ok: false; error: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER
  if (!accountSid || !authToken || !fromNumber) return { ok: false, error: 'Faltan variables TWILIO_* en el servidor' }
  const to = toTwilioWhatsAppNumber(toPhone)
  if (!to) return { ok: false, error: 'Número de teléfono inválido' }
  const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber.replace(/^\+/, '').replace(/\D/g, '')}`
  const params: Record<string, string> = { To: to, From: from, MediaUrl: mediaUrl }
  if (options?.body) params.Body = options.body
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    })
    const text = await r.text()
    if (!r.ok) {
      let err = `HTTP ${r.status}`
      try {
        const j = JSON.parse(text)
        if (j.message) err = j.message
      } catch {
        if (text) err = text.slice(0, 200)
      }
      return { ok: false, error: err }
    }
    let data: { sid?: string } = {}
    try {
      data = JSON.parse(text)
    } catch {
      // ignore
    }
    return { ok: true, sid: data.sid }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error de red' }
  }
}

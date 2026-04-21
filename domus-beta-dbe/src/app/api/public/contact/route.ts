import { NextResponse } from 'next/server'

/**
 * GET: número de contacto por WhatsApp para mostrar en /join y páginas públicas.
 * Solo devuelve formato para mostrar (ej. +52 1 812 123 4567), no expone variables internas.
 */
export async function GET() {
  const raw = process.env.TWILIO_WHATSAPP_NUMBER || ''
  const digits = raw.replace(/^whatsapp:/i, '').replace(/\D/g, '')
  if (digits.length < 12) return NextResponse.json({ ok: true, whatsappDisplay: null })
  // Formatear para lectura: +52 1 812 123 4567 (México móvil)
  const display =
    digits.startsWith('521') && digits.length === 13
      ? `+52 1 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
      : digits.startsWith('52') && digits.length >= 12
        ? `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 12)}${digits.length > 12 ? ' ' + digits.slice(12) : ''}`
        : `+${digits}`
  return NextResponse.json({ ok: true, whatsappDisplay: display, whatsappLink: `https://wa.me/${digits.replace(/^0+/, '')}` })
}

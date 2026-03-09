/**
 * Genera una imagen tipo ticket/recibo (PNG) para compartir por WhatsApp.
 * Estilo recibo compacto, no formal como un PDF.
 */

import sharp from 'sharp'

const W = 380
const H = 240
const OUTPUT_SCALE = 2

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type TicketData = {
  concept: string
  amount: string
  currency: string
  date: string
  time: string
  code: string
  classification?: string
  entityName?: string
}

function buildTicketSvg(data: TicketData): string {
  const concept = escapeXml(data.concept.slice(0, 50))
  const amount = escapeXml(data.amount)
  const currency = escapeXml(data.currency)
  const date = escapeXml(data.date)
  const time = escapeXml(data.time)
  const code = escapeXml(data.code)
  const classification = data.classification ? escapeXml(data.classification.slice(0, 30)) : ''
  const entityName = data.entityName ? escapeXml(data.entityName.slice(0, 25)) : ''

  const outW = W * OUTPUT_SCALE
  const outH = H * OUTPUT_SCALE
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f8f9fa"/>
      <stop offset="1" stop-color="#e9ecef"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)" rx="8" ry="8" stroke="#dee2e6" stroke-width="1"/>
  <line x1="20" y1="52" x2="${W - 20}" y2="52" stroke="#adb5bd" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="32" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#212529">DOMUS</text>
  <text x="${W / 2}" y="48" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">Recibo registrado</text>
  <text x="24" y="78" font-family="system-ui, sans-serif" font-size="11" fill="#495057">Concepto</text>
  <text x="24" y="96" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#212529">${concept}</text>
  <text x="24" y="122" font-family="system-ui, sans-serif" font-size="11" fill="#495057">Monto</text>
  <text x="24" y="140" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#0d6efd">$${amount} ${currency}</text>
  <text x="24" y="166" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">${date} · ${time}</text>
  <text x="24" y="184" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">Clave: ${code}</text>
  ${classification ? `<text x="24" y="206" font-family="system-ui, sans-serif" font-size="10" fill="#495057">${classification}${entityName ? ' → ' + entityName : ''}</text>` : ''}
  <line x1="20" y1="${H - 28}" x2="${W - 20}" y2="${H - 28}" stroke="#adb5bd" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="#adb5bd">D+ domus-fam.com</text>
</svg>`
}

/**
 * Genera un PNG tipo ticket con los datos del recibo. Resolución 2x para pantallas retina.
 */
export async function generateTicketImagePng(data: TicketData): Promise<Buffer> {
  const svg = buildTicketSvg(data)
  return sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toBuffer()
}

/** Datos para el ticket "Recibo de recepción de efectivo" (estilo distinto al recibo de gasto). */
export type CashReceiptTicketData = {
  concept: string
  amount: string
  currency: string
  date: string
  time: string
  code: string
  deliveredBy?: string
}

function buildCashReceiptSvg(data: CashReceiptTicketData): string {
  const concept = escapeXml(data.concept.slice(0, 50))
  const amount = escapeXml(data.amount)
  const currency = escapeXml(data.currency)
  const date = escapeXml(data.date)
  const time = escapeXml(data.time)
  const code = escapeXml(data.code)
  const deliveredBy = data.deliveredBy ? escapeXml(data.deliveredBy.slice(0, 30)) : ''

  const outW = W * OUTPUT_SCALE
  const outH = H * OUTPUT_SCALE
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="cashBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8f5e9"/>
      <stop offset="1" stop-color="#c8e6c9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#cashBg)" rx="8" ry="8" stroke="#81c784" stroke-width="1"/>
  <line x1="20" y1="52" x2="${W - 20}" y2="52" stroke="#66bb6a" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="32" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#2e7d32">DOMUS</text>
  <text x="${W / 2}" y="48" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="#388e3c">Recibo de recepción de efectivo</text>
  <text x="24" y="78" font-family="system-ui, sans-serif" font-size="11" fill="#495057">Concepto</text>
  <text x="24" y="96" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#212529">${concept}</text>
  <text x="24" y="122" font-family="system-ui, sans-serif" font-size="11" fill="#495057">Monto recibido</text>
  <text x="24" y="140" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#2e7d32">$${amount} ${currency}</text>
  <text x="24" y="166" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">${date} · ${time}</text>
  <text x="24" y="184" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">Clave: ${code}</text>
  ${deliveredBy ? `<text x="24" y="206" font-family="system-ui, sans-serif" font-size="10" fill="#495057">Entregado por: ${deliveredBy}</text>` : ''}
  <line x1="20" y1="${H - 28}" x2="${W - 20}" y2="${H - 28}" stroke="#81c784" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="#66bb6a">D+ domus-fam.com</text>
</svg>`
}

/**
 * Genera un PNG tipo ticket "Recibo de recepción de efectivo" (estilo verde, para el solicitante).
 */
export async function generateCashReceiptTicketPng(data: CashReceiptTicketData): Promise<Buffer> {
  const svg = buildCashReceiptSvg(data)
  return sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toBuffer()
}

/** Datos para el ticket de comprobante rechazado (ej. duplicado). Mismo formato que TicketData. */
export type RejectedTicketData = TicketData & { reason?: string }

function buildRejectedTicketSvg(data: RejectedTicketData): string {
  const concept = escapeXml(data.concept.slice(0, 50))
  const amount = escapeXml(data.amount)
  const currency = escapeXml(data.currency)
  const date = escapeXml(data.date)
  const time = escapeXml(data.time)
  const code = escapeXml(data.code)
  const reason = escapeXml((data.reason || 'Duplicado').slice(0, 40))

  const outW = W * OUTPUT_SCALE
  const outH = H * OUTPUT_SCALE
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="rejBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffebee"/>
      <stop offset="1" stop-color="#ffcdd2"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#rejBg)" rx="8" ry="8" stroke="#e57373" stroke-width="2"/>
  <line x1="20" y1="52" x2="${W - 20}" y2="52" stroke="#ef5350" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="28" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#c62828">DOMUS</text>
  <text x="${W / 2}" y="46" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#b71c1c">RECHAZADO — ${reason}</text>
  <text x="24" y="76" font-family="system-ui, sans-serif" font-size="11" fill="#5d4037">Concepto</text>
  <text x="24" y="94" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#212529">${concept}</text>
  <text x="24" y="120" font-family="system-ui, sans-serif" font-size="11" fill="#5d4037">Monto</text>
  <text x="24" y="138" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#c62828">$${amount} ${currency}</text>
  <text x="24" y="164" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">${date} · ${time}</text>
  <text x="24" y="182" font-family="system-ui, sans-serif" font-size="10" fill="#6c757d">Clave: ${code}</text>
  <line x1="20" y1="${H - 28}" x2="${W - 20}" y2="${H - 28}" stroke="#e57373" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${W / 2}" y="${H - 10}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" fill="#c62828">Envíe el comprobante correcto o descarte</text>
</svg>`
}

/**
 * Genera un PNG de recibo rechazado (estilo rojo) para avisar al usuario (ej. duplicado).
 */
export async function generateRejectedTicketImagePng(data: RejectedTicketData): Promise<Buffer> {
  const svg = buildRejectedTicketSvg(data)
  return sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toBuffer()
}

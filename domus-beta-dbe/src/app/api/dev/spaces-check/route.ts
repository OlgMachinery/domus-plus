import { NextResponse } from 'next/server'

const VARS = ['DO_SPACES_ENDPOINT', 'DO_SPACES_REGION', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET'] as const

/**
 * GET /api/dev/spaces-check
 * Devuelve qué variables DO_SPACES_* están definidas (sin mostrar valores).
 * Útil cuando falla la subida de comprobantes y sale "Falta configurar DigitalOcean Spaces".
 */
export async function GET() {
  const missing = VARS.filter((name) => {
    const v = process.env[name]
    return v === undefined || v === '' || (typeof v === 'string' && !v.trim())
  })
  const ok = missing.length === 0
  const message = ok
    ? 'Spaces configurado: todas las variables DO_SPACES_* están definidas.'
    : `Faltan: ${missing.join(', ')}. Añádelas al .env en la VPS y reinicia el servicio (ej. sudo systemctl restart domus-beta). Ver domus-beta-dbe/docs/DONDE_ESTA_ENV.md`
  return NextResponse.json({ ok, missing, message })
}

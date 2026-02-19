import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 5

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'El servidor responde correctamente.',
    timestamp: new Date().toISOString(),
  })
}

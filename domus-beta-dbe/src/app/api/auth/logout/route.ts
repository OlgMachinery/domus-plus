import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 })
  clearSessionCookie(req, res)
  return res
}


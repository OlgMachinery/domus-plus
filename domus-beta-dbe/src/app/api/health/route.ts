import { NextResponse } from 'next/server'
import { ensureSqlitePragmas, prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    await ensureSqlitePragmas()
    // Prueba mínima de conexión
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'connected' }, { status: 200 })
  } catch {
    return NextResponse.json({ status: 'error', db: 'down' }, { status: 500 })
  }
}


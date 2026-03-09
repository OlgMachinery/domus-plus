import { NextResponse } from 'next/server'
import { ensureSqlitePragmas, prisma } from '@/lib/db/prisma'

export async function GET() {
  try {
    await ensureSqlitePragmas()
    await prisma.$queryRaw`SELECT 1`
    const userCount = await prisma.user.count().catch(() => 0)
    return NextResponse.json(
      { status: 'ok', db: 'connected', users: userCount },
      { status: 200 }
    )
  } catch (err) {
    console.error('[health] DB error:', err)
    return NextResponse.json({ status: 'error', db: 'down' }, { status: 500 })
  }
}


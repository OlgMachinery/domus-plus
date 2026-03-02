import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    }),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

let pragmasApplied = false

export async function ensureSqlitePragmas() {
  if (pragmasApplied) return
  pragmasApplied = true
  // Reduce bloqueos en concurrencia baja (Beta): WAL + espera en vez de fallar rápido
  const pragmas = ['PRAGMA journal_mode=WAL;', 'PRAGMA busy_timeout=5000;', 'PRAGMA foreign_keys=ON;'] as const
  for (const stmt of pragmas) {
    try {
      await prisma.$executeRawUnsafe(stmt)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[sqlite] No se pudo aplicar: ${stmt}`, err)
      }
    }
  }
}


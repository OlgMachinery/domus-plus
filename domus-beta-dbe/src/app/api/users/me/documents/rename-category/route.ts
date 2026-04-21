import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const CATEGORY_MAX_LEN = 80

function safeCategory(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, CATEGORY_MAX_LEN) || 'Otro'
}

/** POST: renombrar una categoría (actualiza todos los documentos del usuario en esa categoría). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const oldCategory = typeof body.oldCategory === 'string' ? body.oldCategory.trim() : ''
    const newCategoryRaw = typeof body.newCategory === 'string' ? body.newCategory.trim() : ''
    if (!oldCategory) return jsonError('Falta oldCategory', 400)
    if (!newCategoryRaw) return jsonError('Falta newCategory', 400)
    const newCategory = safeCategory(newCategoryRaw)
    if (newCategory === oldCategory) return NextResponse.json({ ok: true, updated: 0 })

    const result = await prisma.userDocument.updateMany({
      where: { userId, category: oldCategory },
      data: { category: newCategory },
    })
    return NextResponse.json({ ok: true, updated: result.count })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

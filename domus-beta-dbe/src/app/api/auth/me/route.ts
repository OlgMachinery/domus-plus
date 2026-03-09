import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl, extractKeyFromSpacesUrl } from '@/lib/storage/spaces'

export async function GET(req: NextRequest) {
  try {
    const { userId, familyId } = await requireAuth(req)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, phone: true, city: true, avatarUrl: true },
    })
    if (!user) return jsonError('No autenticado', 401)

    let avatarUrl = user.avatarUrl ?? null
    if (avatarUrl) {
      try {
        const key = extractKeyFromSpacesUrl(avatarUrl)
        if (key) avatarUrl = await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 60 })
      } catch {
        avatarUrl = user.avatarUrl
      }
    }

    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true, isFamilyAdmin: true, family: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const activeMembership = familyId ? memberships.find((m) => m.familyId === familyId) : null

    return NextResponse.json({
      ok: true,
      user: { ...user, avatarUrl },
      activeFamily: activeMembership?.family ?? null,
      isFamilyAdmin: activeMembership?.isFamilyAdmin ?? false,
      families: memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        isFamilyAdmin: m.isFamilyAdmin,
      })),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}


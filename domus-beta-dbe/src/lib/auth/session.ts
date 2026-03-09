import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { ensureSqlitePragmas, prisma } from '@/lib/db/prisma'

export const SESSION_COOKIE = 'domus_token'

export type AuthContext = {
  userId: string
  familyId: string | null
}

export type MembershipContext = {
  userId: string
  familyId: string
  isFamilyAdmin: boolean
}

function readTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim() || null
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  return cookie || null
}

export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const token = readTokenFromRequest(req)
  if (!token) throw new Error('No autenticado')
  const { userId: realUserId, familyId } = await verifyToken(token)

  const viewAsUserId = req.headers.get('x-view-as-user')?.trim() || null
  if (!viewAsUserId || viewAsUserId === realUserId || !familyId) {
    return { userId: realUserId, familyId }
  }

  await ensureSqlitePragmas()
  const realMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: realUserId } },
    select: { isFamilyAdmin: true },
  })
  if (!realMembership?.isFamilyAdmin) return { userId: realUserId, familyId }

  const targetMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: viewAsUserId } },
    select: { userId: true },
  })
  if (!targetMembership) return { userId: realUserId, familyId }

  return { userId: viewAsUserId, familyId }
}

export async function requireMembership(req: NextRequest): Promise<MembershipContext> {
  const { userId, familyId } = await requireAuth(req)
  if (!familyId) throw new Error('No hay familia activa')
  await ensureSqlitePragmas()
  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId } },
    select: { isFamilyAdmin: true },
  })
  if (!membership) throw new Error('No tienes acceso a esta familia')
  return { userId, familyId, isFamilyAdmin: membership.isFamilyAdmin }
}

export function jsonError(detail: string, status = 401) {
  return NextResponse.json({ detail }, { status })
}

function isHttpsRequest(req: NextRequest): boolean {
  const xfProto = req.headers.get('x-forwarded-proto')
  if (xfProto) {
    const first = xfProto.split(',')[0]?.trim().toLowerCase()
    if (first === 'https') return true
  }
  try {
    return req.nextUrl.protocol === 'https:'
  } catch {
    return false
  }
}

export function setSessionCookie(req: NextRequest, res: NextResponse, token: string) {
  const secure = isHttpsRequest(req)
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearSessionCookie(req: NextRequest, res: NextResponse) {
  const secure = isHttpsRequest(req)
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  })
}


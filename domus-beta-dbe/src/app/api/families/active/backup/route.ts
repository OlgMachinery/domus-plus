import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { uploadToSpaces } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'

function safeFilePart(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function jsonSafe(value: any): any {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (typeof value === 'object') {
    const ctor = (value as any)?.constructor?.name
    if (ctor === 'Decimal' && typeof (value as any)?.toString === 'function') return (value as any).toString()
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v)
    return out
  }
  return value
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar la familia', 403)

    const body = (await req.json().catch(() => ({}))) as any
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return jsonError('Usuario y contraseña son requeridos', 400)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, name: true },
    })
    if (!user) return jsonError('No autenticado', 401)
    if (String(user.email || '').trim().toLowerCase() !== email) return jsonError('Credenciales inválidas', 400)
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return jsonError('Credenciales inválidas', 400)

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        currency: true,
        cutoffDay: true,
        budgetStartDate: true,
        setupComplete: true,
        planStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!family) return jsonError('Familia no encontrada', 404)

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: {
        id: true,
        familyId: true,
        userId: true,
        isFamilyAdmin: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true, phone: true, createdAt: true, updatedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const entities = await prisma.entity.findMany({
      where: { familyId },
      select: { id: true, familyId: true, type: true, name: true, isActive: true, participatesInBudget: true, participatesInReports: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const categories = await prisma.budgetCategory.findMany({
      where: { familyId },
      select: { id: true, familyId: true, type: true, name: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const allocations = await prisma.budgetAccount.findMany({
      where: { familyId },
      select: { id: true, familyId: true, entityId: true, serviceId: true, monthlyLimit: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const transactions = await prisma.transaction.findMany({
      where: { familyId },
      select: {
        id: true,
        familyId: true,
        userId: true,
        budgetAccountId: true,
        amount: true,
        date: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        receipts: {
          select: {
            id: true,
            transactionId: true,
            userId: true,
            familyId: true,
            fileUrl: true,
            createdAt: true,
            updatedAt: true,
            images: { select: { id: true, receiptId: true, fileUrl: true, sortOrder: true, createdAt: true, updatedAt: true }, orderBy: { sortOrder: 'asc' } },
            extraction: {
              select: {
                id: true,
                receiptId: true,
                familyId: true,
                userId: true,
                confirmedAt: true,
                confirmedByUserId: true,
                merchantName: true,
                receiptDate: true,
                total: true,
                currency: true,
                tax: true,
                tip: true,
                rawText: true,
                rawJson: true,
                metaJson: true,
                createdAt: true,
                updatedAt: true,
                items: {
                  select: {
                    id: true,
                    extractionId: true,
                    lineNumber: true,
                    description: true,
                    rawLine: true,
                    quantity: true,
                    unitPrice: true,
                    amount: true,
                    isAdjustment: true,
                    isPlaceholder: true,
                    lineType: true,
                    notesJson: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                  orderBy: { lineNumber: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const backup = jsonSafe({
      domusBackup: true,
      version: 1,
      createdAt: new Date().toISOString(),
      createdBy: { userId: user.id, email: user.email, name: user.name || null },
      family,
      members,
      budget: { entities, categories, allocations },
      transactions,
    })

    const backupJson = JSON.stringify(backup)
    const sha256 = createHash('sha256').update(backupJson, 'utf8').digest('hex')

    const archive = await prisma.deletionArchive.create({
      data: {
        kind: 'family',
        familyId: family.id,
        familyName: family.name,
        createdByUserId: userId,
        payloadJson: backupJson,
        payloadSha256: sha256,
      },
      select: { id: true },
    })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const key = `backups/families/${family.id}/${ts}-${archive.id}.json`
    const url = await uploadToSpaces({ key, body: Buffer.from(backupJson, 'utf8'), contentType: 'application/json' })
    await prisma.deletionArchive.update({ where: { id: archive.id }, data: { spacesKey: key, spacesUrl: url } })

    const filename = `.${safeFilePart(`domus_recovery_${family.name}`)}_${new Date().toISOString().slice(0, 10)}_${archive.id.slice(0, 8)}.json`

    return NextResponse.json(
      {
        ok: true,
        archiveId: archive.id,
        filename,
        sha256,
        backupJson,
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo generar el respaldo'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityKind } from '@/generated/prisma/client'
import { ensureFamilyRootEntity } from '@/lib/budget/ensure-family-root-entity'
import { getOrCreateServiceFromBudgetCategoryName } from '@/lib/budget/legacy-category-to-service'
import { getOrCreateBudgetAccount } from '@/lib/budget/get-or-create-budget-account'

export const dynamic = 'force-dynamic'

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede completar el onboarding', 403)

    const body = await req.json().catch(() => ({}))
    const integrantes = Array.isArray(body.integrantes) ? body.integrantes : []
    const mascotas = Array.isArray(body.mascotas) ? body.mascotas : []
    const vehiculos = Array.isArray(body.vehiculos) ? body.vehiculos : []
    const casa = body.casa !== false
    const jardin = body.jardin === true || (typeof body.jardin === 'string' && body.jardin.trim() !== '')
    const nombreJardin = typeof body.jardin === 'string' && body.jardin.trim() ? body.jardin.trim() : 'Jardín'
    const comidaFamilia = body.comidaFamilia === true
    const fondos = Array.isArray(body.fondos) ? body.fondos : []
    const categorias = Array.isArray(body.categorias) ? body.categorias : []
    const inventory = Array.isArray(body.inventory) ? body.inventory : []

    const created = await prisma.$transaction(async (tx) => {
      await ensureFamilyRootEntity(tx, familyId)

      const entityIds: { casaId: string | null; ids: string[] } = { casaId: null, ids: [] }
      const categoryIds: string[] = []
      let assetsCreated = 0

      const existingCasa = await tx.entity.findFirst({
        where: { familyId, type: EntityKind.ASSET, subtype: 'casa', name: 'Casa', isActive: true },
        select: { id: true },
      })

      if (casa && !existingCasa) {
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.ASSET,
            subtype: 'casa',
            name: 'Casa',
            isActive: true,
            participatesInBudget: true,
            participatesInReports: true,
          },
          select: { id: true },
        })
        entityIds.casaId = e.id
        entityIds.ids.push(e.id)
      } else if (existingCasa) {
        entityIds.casaId = existingCasa.id
      }

      if (jardin) {
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.ASSET,
            subtype: 'casa',
            name: nombreJardin,
            isActive: true,
            participatesInBudget: true,
            participatesInReports: true,
          },
          select: { id: true },
        })
        entityIds.ids.push(e.id)
      }

      if (comidaFamilia) {
        const existing = await tx.entity.findFirst({
          where: { familyId, type: EntityKind.ASSET, subtype: 'familia', name: 'Comida (Familia)', isActive: true },
          select: { id: true },
        })
        if (!existing) {
          const e = await tx.entity.create({
            data: {
              familyId,
              type: EntityKind.ASSET,
              subtype: 'familia',
              name: 'Comida (Familia)',
              isActive: true,
              participatesInBudget: true,
              participatesInReports: true,
            },
            select: { id: true },
          })
          entityIds.ids.push(e.id)
        }
      }

      for (const i of integrantes) {
        const name = typeof i.name === 'string' ? i.name.trim() : ''
        if (!name) continue
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.PERSON,
            name,
            isActive: true,
            participatesInBudget: true,
            participatesInReports: true,
          },
          select: { id: true },
        })
        entityIds.ids.push(e.id)
      }

      for (const m of mascotas) {
        const name = typeof m.name === 'string' ? m.name.trim() : 'Mascota'
        if (!name) continue
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.PET,
            name,
            isActive: true,
            participatesInBudget: true,
            participatesInReports: false,
          },
          select: { id: true },
        })
        entityIds.ids.push(e.id)
      }

      type VehiculoPayload = {
        name?: string
        type?: string
        marca?: string
        modelo?: string
        year?: string
        serie?: string
        photos?: unknown[]
        videos?: unknown[]
      }
      for (const v of vehiculos) {
        const vp = v as VehiculoPayload
        const name = typeof vp.name === 'string' ? vp.name.trim() : 'Vehículo'
        if (!name) continue
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.ASSET,
            subtype: 'auto',
            name,
            isActive: true,
            participatesInBudget: true,
            participatesInReports: true,
          },
          select: { id: true },
        })
        entityIds.ids.push(e.id)

        const vPhotos = Array.isArray(vp.photos) ? vp.photos.filter((u): u is string => typeof u === 'string').slice(0, 10) : []
        const vVideos = Array.isArray(vp.videos) ? vp.videos.filter((u): u is string => typeof u === 'string').slice(0, 2) : []
        const hasMedia = vPhotos.length > 0 || vVideos.length > 0
        const hasDetails =
          (typeof vp.marca === 'string' && vp.marca.trim() !== '') ||
          (typeof vp.modelo === 'string' && vp.modelo.trim() !== '') ||
          (typeof vp.year === 'string' && vp.year.trim() !== '') ||
          (typeof vp.serie === 'string' && vp.serie.trim() !== '')
        if (hasMedia || hasDetails) {
          const marca = typeof vp.marca === 'string' ? vp.marca.trim() || undefined : undefined
          const modelo = typeof vp.modelo === 'string' ? vp.modelo.trim() || undefined : undefined
          const year = typeof vp.year === 'string' ? vp.year.trim() || undefined : undefined
          const serialNumber = typeof vp.serie === 'string' ? vp.serie.trim() || undefined : undefined
          const asset = await tx.familyAsset.create({
            data: {
              familyId,
              type: 'VEHICLE',
              name,
              marca: marca ?? undefined,
              modelo: modelo ?? undefined,
              year: year ?? undefined,
              serialNumber: serialNumber ?? undefined,
            },
            select: { id: true },
          })
          let sortOrder = 0
          for (const url of vPhotos) {
            await tx.familyAssetMedia.create({
              data: { assetId: asset.id, kind: 'PHOTO', url, sortOrder: sortOrder++ },
            })
          }
          for (const url of vVideos) {
            await tx.familyAssetMedia.create({
              data: { assetId: asset.id, kind: 'VIDEO', url, sortOrder: sortOrder++ },
            })
          }
          assetsCreated++
        }
      }

      for (const f of fondos) {
        const name = typeof f.name === 'string' ? f.name.trim() : ''
        if (!name) continue
        const subtype = f.type === 'PROJECT' ? 'proyecto' : 'fondo'
        const e = await tx.entity.create({
          data: {
            familyId,
            type: EntityKind.ASSET,
            subtype,
            name,
            isActive: true,
            participatesInBudget: true,
            participatesInReports: true,
          },
          select: { id: true },
        })
        entityIds.ids.push(e.id)
      }

      const categoryWithLimit: { id: string; monthlyLimit: number; label: string }[] = []
      for (const c of categorias) {
        const catName = typeof c.name === 'string' ? c.name.trim() : ''
        if (!catName) continue
        const cat = await tx.budgetCategory.create({
          data: { familyId, name: catName, type: 'EXPENSE', isActive: true },
          select: { id: true },
        })
        categoryIds.push(cat.id)
        const limit = toPositiveNumber(c.monthlyLimit)
        if (limit !== null && limit > 0) {
          categoryWithLimit.push({ id: cat.id, monthlyLimit: limit, label: catName })
        }
      }

      const casaId = entityIds.casaId
      let allocationsCreated = 0
      if (casaId) {
        for (const entry of categoryWithLimit) {
          const svc = await getOrCreateServiceFromBudgetCategoryName(tx, entry.label)
          await tx.entityService.upsert({
            where: { entityId_serviceId: { entityId: casaId, serviceId: svc.id } },
            create: { familyId, entityId: casaId, serviceId: svc.id, isActive: true },
            update: { isActive: true },
          })
          const acc = await getOrCreateBudgetAccount(familyId, casaId, svc.id, tx)
          await tx.budgetAccount.update({
            where: { id: acc.id },
            data: { monthlyLimit: String(entry.monthlyLimit), isActive: true },
          })
          allocationsCreated++
        }
      }

      type InventoryItem = {
        typeName?: string
        year?: string
        model?: string
        inventoryCode?: string
        photos?: string[]
        videos?: string[]
      }
      const inventoryPayload = inventory
        .map((item: InventoryItem) => ({
          typeName: typeof item.typeName === 'string' ? item.typeName.trim() : '',
          year: typeof item.year === 'string' ? item.year : undefined,
          model: typeof item.model === 'string' ? item.model : undefined,
          inventoryCode: typeof item.inventoryCode === 'string' ? item.inventoryCode.trim() : undefined,
          photos: Array.isArray(item.photos) ? item.photos.filter((u): u is string => typeof u === 'string').slice(0, 10) : [],
          videos: Array.isArray(item.videos) ? item.videos.filter((u): u is string => typeof u === 'string').slice(0, 2) : [],
        }))
        .filter((item: { typeName: string }) => !!item.typeName)

      for (const item of inventoryPayload) {
        const { typeName, year, model, inventoryCode, photos = [], videos = [] } = item
        const asset = await tx.familyAsset.create({
          data: {
            familyId,
            type: 'ARTICLE',
            name: typeName,
            inventoryCode: inventoryCode || undefined,
            modelo: model || undefined,
            year: year || undefined,
          },
          select: { id: true },
        })
        let sortOrder = 0
        for (const url of photos) {
          await tx.familyAssetMedia.create({
            data: { assetId: asset.id, kind: 'PHOTO', url, sortOrder: sortOrder++ },
          })
        }
        for (const url of videos) {
          await tx.familyAssetMedia.create({
            data: { assetId: asset.id, kind: 'VIDEO', url, sortOrder: sortOrder++ },
          })
        }
        assetsCreated++
      }

      await tx.family.update({
        where: { id: familyId },
        data: {
          setupComplete: true,
          ...(inventoryPayload.length > 0
            ? {
                inventoryJson: {
                  items: inventoryPayload.map(
                    (i: { typeName: string; year?: string; model?: string; inventoryCode?: string }) => ({
                      typeName: i.typeName,
                      year: i.year,
                      model: i.model,
                      inventoryCode: i.inventoryCode,
                    })
                  ),
                },
              }
            : {}),
        },
      })

      return {
        entities: entityIds.ids.length,
        categories: categoryIds.length,
        allocations: allocationsCreated,
        assets: assetsCreated,
      }
    })

    return NextResponse.json({
      ok: true,
      message: 'Familia configurada. Ya puedes usar Presupuesto y Transacciones.',
      created,
    })
  } catch (e: unknown) {
    console.error('onboarding POST:', e)
    const msg = e instanceof Error ? e.message : 'No se pudo completar el onboarding'
    return jsonError(msg, 500)
  }
}

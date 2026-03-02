import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityType } from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth/password'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { randomBytes } from 'node:crypto'

function norm(s: string) {
  return s.trim().toLowerCase()
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function familyTag(familyId: string) {
  return familyId.replace(/-/g, '').slice(0, 8) || familyId.slice(0, 8)
}

function demoEmail(tag: string, key: string) {
  // Emails únicos por familia para evitar colisiones entre instalaciones
  return `demo+${tag}+${key}@domus.local`.toLowerCase()
}

function generatePassword() {
  const n = randomBytes(4).readUInt32BE(0) % 100000000
  return `Domus!${String(n).padStart(8, '0')}`
}

const DEMO_USERS: { key: string; name: string; isFamilyAdmin: boolean }[] = [
  // Mantener keys estables para no crear usuarios duplicados entre versiones
  { key: 'admin2', name: 'Mamá Demo', isFamilyAdmin: true },
  { key: 'carlos', name: 'Papá Demo', isFamilyAdmin: false },
  { key: 'laura', name: 'Laura Demo', isFamilyAdmin: false },
  { key: 'sofia', name: 'Sofía Demo', isFamilyAdmin: false },
  { key: 'mateo', name: 'Mateo Demo', isFamilyAdmin: false },
  // 6 integrantes extra (demo) para análisis horizontal/vertical
  { key: 'diego', name: 'Diego Demo', isFamilyAdmin: false },
  { key: 'valeria', name: 'Valeria Demo', isFamilyAdmin: false },
  { key: 'emilia', name: 'Emilia Demo', isFamilyAdmin: false },
  { key: 'sebastian', name: 'Sebastián Demo', isFamilyAdmin: false },
  { key: 'daniela', name: 'Daniela Demo', isFamilyAdmin: false },
  { key: 'andres', name: 'Andrés Demo', isFamilyAdmin: false },
]

const SEED_ENTITIES: {
  name: string
  type: EntityType
  participatesInBudget: boolean
  participatesInReports: boolean
}[] = [
  { name: 'Mamá', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Papá', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Laura', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Sofía', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Mateo', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Diego', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Valeria', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Emilia', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Sebastián', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Daniela', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Andrés', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Casa', type: EntityType.HOUSE, participatesInBudget: true, participatesInReports: true },
  // Compartido entre todos (comida)
  { name: 'Comida (Familia)', type: EntityType.GROUP, participatesInBudget: true, participatesInReports: true },
  { name: 'Auto', type: EntityType.VEHICLE, participatesInBudget: true, participatesInReports: true },
  // Objeto "personal" (sigue siendo Compartido por regla del sistema, pero con 1 responsable)
  { name: 'Auto (Mamá)', type: EntityType.VEHICLE, participatesInBudget: true, participatesInReports: true },
  { name: 'Pelusa', type: EntityType.PET, participatesInBudget: true, participatesInReports: false },
  { name: 'Fondo de emergencia', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  // Varios tipos de ahorro (objetivos)
  { name: 'Retiro', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Educación (Sofía)', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Educación (Mateo)', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Inversión', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Vacaciones', type: EntityType.PROJECT, participatesInBudget: true, participatesInReports: true },
]

const SEED_CATEGORIES: { name: string; type: string }[] = [
  { name: 'Renta / Hipoteca', type: 'EXPENSE' },
  { name: 'Supermercado', type: 'EXPENSE' },
  { name: 'Servicios (luz/agua/internet)', type: 'EXPENSE' },
  { name: 'Internet / Teléfono', type: 'EXPENSE' },
  { name: 'Limpieza / Hogar', type: 'EXPENSE' },
  { name: 'Reparaciones de casa', type: 'EXPENSE' },
  { name: 'Mantenimiento auto', type: 'EXPENSE' },
  { name: 'Seguro auto', type: 'EXPENSE' },
  { name: 'Gasolina', type: 'EXPENSE' },
  { name: 'Mascotas', type: 'EXPENSE' },
  { name: 'Veterinario', type: 'EXPENSE' },
  { name: 'Colegiaturas', type: 'EXPENSE' },
  { name: 'Útiles escolares', type: 'EXPENSE' },
  { name: 'Salud / Doctor', type: 'EXPENSE' },
  { name: 'Farmacia', type: 'EXPENSE' },
  { name: 'Ahorro', type: 'EXPENSE' },
  { name: 'Entretenimiento', type: 'EXPENSE' },
  { name: 'Restaurantes', type: 'EXPENSE' },
  { name: 'Ropa', type: 'EXPENSE' },
  { name: 'Suscripciones', type: 'EXPENSE' },
  { name: 'Vacaciones', type: 'EXPENSE' },
]

const SEED_ALLOCATIONS: { entityName: string; categoryName: string; monthlyLimit: string }[] = [
  { entityName: 'Casa', categoryName: 'Renta / Hipoteca', monthlyLimit: '12000' },
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', monthlyLimit: '1500' },
  { entityName: 'Casa', categoryName: 'Internet / Teléfono', monthlyLimit: '700' },
  { entityName: 'Casa', categoryName: 'Limpieza / Hogar', monthlyLimit: '500' },
  { entityName: 'Casa', categoryName: 'Reparaciones de casa', monthlyLimit: '800' },
  { entityName: 'Casa', categoryName: 'Entretenimiento', monthlyLimit: '1000' },
  // Comida (compartido por todos)
  { entityName: 'Comida (Familia)', categoryName: 'Supermercado', monthlyLimit: '5500' },
  { entityName: 'Comida (Familia)', categoryName: 'Restaurantes', monthlyLimit: '1500' },
  { entityName: 'Auto', categoryName: 'Gasolina', monthlyLimit: '1800' },
  { entityName: 'Auto', categoryName: 'Mantenimiento auto', monthlyLimit: '600' },
  { entityName: 'Auto', categoryName: 'Seguro auto', monthlyLimit: '400' },
  { entityName: 'Auto (Mamá)', categoryName: 'Gasolina', monthlyLimit: '900' },
  { entityName: 'Auto (Mamá)', categoryName: 'Seguro auto', monthlyLimit: '250' },
  { entityName: 'Pelusa', categoryName: 'Mascotas', monthlyLimit: '600' },
  { entityName: 'Pelusa', categoryName: 'Veterinario', monthlyLimit: '300' },
  { entityName: 'Sofía', categoryName: 'Colegiaturas', monthlyLimit: '2500' },
  { entityName: 'Sofía', categoryName: 'Útiles escolares', monthlyLimit: '300' },
  { entityName: 'Mateo', categoryName: 'Colegiaturas', monthlyLimit: '2000' },
  { entityName: 'Mamá', categoryName: 'Salud / Doctor', monthlyLimit: '400' },
  { entityName: 'Mamá', categoryName: 'Farmacia', monthlyLimit: '300' },
  { entityName: 'Mamá', categoryName: 'Ahorro', monthlyLimit: '500' },
  { entityName: 'Papá', categoryName: 'Restaurantes', monthlyLimit: '800' },
  { entityName: 'Papá', categoryName: 'Ropa', monthlyLimit: '600' },
  { entityName: 'Papá', categoryName: 'Ahorro', monthlyLimit: '400' },
  { entityName: 'Laura', categoryName: 'Entretenimiento', monthlyLimit: '700' },
  { entityName: 'Laura', categoryName: 'Suscripciones', monthlyLimit: '220' },
  { entityName: 'Diego', categoryName: 'Restaurantes', monthlyLimit: '650' },
  { entityName: 'Diego', categoryName: 'Ropa', monthlyLimit: '450' },
  { entityName: 'Diego', categoryName: 'Salud / Doctor', monthlyLimit: '300' },
  { entityName: 'Valeria', categoryName: 'Colegiaturas', monthlyLimit: '2200' },
  { entityName: 'Valeria', categoryName: 'Útiles escolares', monthlyLimit: '320' },
  { entityName: 'Valeria', categoryName: 'Entretenimiento', monthlyLimit: '300' },
  { entityName: 'Emilia', categoryName: 'Colegiaturas', monthlyLimit: '2100' },
  { entityName: 'Emilia', categoryName: 'Útiles escolares', monthlyLimit: '280' },
  { entityName: 'Sebastián', categoryName: 'Colegiaturas', monthlyLimit: '2400' },
  { entityName: 'Sebastián', categoryName: 'Ropa', monthlyLimit: '350' },
  { entityName: 'Sebastián', categoryName: 'Entretenimiento', monthlyLimit: '400' },
  { entityName: 'Daniela', categoryName: 'Salud / Doctor', monthlyLimit: '500' },
  { entityName: 'Daniela', categoryName: 'Farmacia', monthlyLimit: '250' },
  { entityName: 'Daniela', categoryName: 'Ropa', monthlyLimit: '450' },
  { entityName: 'Andrés', categoryName: 'Restaurantes', monthlyLimit: '900' },
  { entityName: 'Andrés', categoryName: 'Ropa', monthlyLimit: '500' },
  { entityName: 'Andrés', categoryName: 'Suscripciones', monthlyLimit: '180' },
  { entityName: 'Casa', categoryName: 'Suscripciones', monthlyLimit: '250' },
  { entityName: 'Fondo de emergencia', categoryName: 'Ahorro', monthlyLimit: '2000' },
  { entityName: 'Retiro', categoryName: 'Ahorro', monthlyLimit: '2500' },
  { entityName: 'Educación (Sofía)', categoryName: 'Ahorro', monthlyLimit: '900' },
  { entityName: 'Educación (Mateo)', categoryName: 'Ahorro', monthlyLimit: '700' },
  { entityName: 'Inversión', categoryName: 'Ahorro', monthlyLimit: '1200' },
  { entityName: 'Vacaciones', categoryName: 'Vacaciones', monthlyLimit: '1500' },
]

const SEED_TRANSACTIONS: {
  entityName: string
  categoryName: string
  amount: string
  date: Date
  description: string
  userKey?: string
}[] = [
  { entityName: 'Casa', categoryName: 'Renta / Hipoteca', amount: '11800', date: daysAgo(3), description: 'Pago renta (ejemplo)', userKey: 'admin2' },
  // Nota: estos 2 ya existían históricamente en demo bajo "Casa". Los dejamos así para evitar duplicarlos al re-seedear.
  { entityName: 'Casa', categoryName: 'Supermercado', amount: '1350', date: daysAgo(6), description: 'Supermercado semana 1', userKey: 'carlos' },
  { entityName: 'Casa', categoryName: 'Supermercado', amount: '1120', date: daysAgo(12), description: 'Supermercado semana 2', userKey: 'admin2' },
  { entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '420', date: daysAgo(2), description: 'Supermercado (compras rápidas)', userKey: 'laura' },
  { entityName: 'Comida (Familia)', categoryName: 'Restaurantes', amount: '380', date: daysAgo(5), description: 'Comida fuera (familia)', userKey: 'sofia' },
  { entityName: 'Comida (Familia)', categoryName: 'Restaurantes', amount: '260', date: daysAgo(9), description: 'Café/antojitos (familia)', userKey: 'mateo' },
  { entityName: 'Casa', categoryName: 'Internet / Teléfono', amount: '699', date: daysAgo(9), description: 'Internet mensual', userKey: 'carlos' },
  { entityName: 'Casa', categoryName: 'Reparaciones de casa', amount: '480', date: daysAgo(7), description: 'Plomería (ejemplo)', userKey: 'admin2' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '820', date: daysAgo(8), description: 'Gasolina', userKey: 'carlos' },
  { entityName: 'Auto', categoryName: 'Mantenimiento auto', amount: '550', date: daysAgo(15), description: 'Cambio de aceite', userKey: 'carlos' },
  { entityName: 'Auto (Mamá)', categoryName: 'Gasolina', amount: '520', date: daysAgo(6), description: 'Gasolina Auto (Mamá)', userKey: 'admin2' },
  { entityName: 'Auto (Mamá)', categoryName: 'Seguro auto', amount: '250', date: daysAgo(4), description: 'Seguro Auto (Mamá)', userKey: 'admin2' },
  { entityName: 'Pelusa', categoryName: 'Veterinario', amount: '350', date: daysAgo(10), description: 'Veterinario', userKey: 'sofia' },
  { entityName: 'Pelusa', categoryName: 'Mascotas', amount: '400', date: daysAgo(6), description: 'Croquetas Pelusa', userKey: 'laura' },
  { entityName: 'Sofía', categoryName: 'Colegiaturas', amount: '2500', date: daysAgo(4), description: 'Colegiatura mensual', userKey: 'admin2' },
  { entityName: 'Sofía', categoryName: 'Útiles escolares', amount: '280', date: daysAgo(13), description: 'Útiles escolares', userKey: 'sofia' },
  { entityName: 'Mateo', categoryName: 'Colegiaturas', amount: '2000', date: daysAgo(5), description: 'Colegiatura mensual', userKey: 'admin2' },
  { entityName: 'Mamá', categoryName: 'Salud / Doctor', amount: '390', date: daysAgo(11), description: 'Consulta (ejemplo)', userKey: 'admin2' },
  { entityName: 'Mamá', categoryName: 'Farmacia', amount: '160', date: daysAgo(1), description: 'Farmacia', userKey: 'laura' },
  { entityName: 'Mamá', categoryName: 'Ahorro', amount: '450', date: daysAgo(2), description: 'Ahorro personal Mamá', userKey: 'admin2' },
  { entityName: 'Papá', categoryName: 'Ahorro', amount: '400', date: daysAgo(3), description: 'Ahorro personal Papá', userKey: 'carlos' },
  { entityName: 'Casa', categoryName: 'Suscripciones', amount: '199', date: daysAgo(2), description: 'Streaming', userKey: 'carlos' },
  { entityName: 'Vacaciones', categoryName: 'Vacaciones', amount: '750', date: daysAgo(14), description: 'Ahorro vacaciones', userKey: 'carlos' },
  { entityName: 'Fondo de emergencia', categoryName: 'Ahorro', amount: '1000', date: daysAgo(5), description: 'Transferencia a fondo', userKey: 'admin2' },
  { entityName: 'Fondo de emergencia', categoryName: 'Ahorro', amount: '650', date: daysAgo(7), description: 'Aportación fondo (Papá)', userKey: 'carlos' },
  { entityName: 'Fondo de emergencia', categoryName: 'Ahorro', amount: '250', date: daysAgo(9), description: 'Aportación fondo (Laura)', userKey: 'laura' },
  { entityName: 'Retiro', categoryName: 'Ahorro', amount: '1300', date: daysAgo(8), description: 'Ahorro retiro (Papá)', userKey: 'carlos' },
  { entityName: 'Retiro', categoryName: 'Ahorro', amount: '900', date: daysAgo(10), description: 'Ahorro retiro (Mamá)', userKey: 'admin2' },
  { entityName: 'Educación (Sofía)', categoryName: 'Ahorro', amount: '600', date: daysAgo(6), description: 'Ahorro educación Sofía', userKey: 'admin2' },
  { entityName: 'Educación (Mateo)', categoryName: 'Ahorro', amount: '500', date: daysAgo(6), description: 'Ahorro educación Mateo', userKey: 'admin2' },
  { entityName: 'Inversión', categoryName: 'Ahorro', amount: '900', date: daysAgo(12), description: 'Ahorro inversión', userKey: 'carlos' },
  // Integrantes extra: gasto individual + gasto compartido (para ver "Todo" en análisis)
  { entityName: 'Diego', categoryName: 'Restaurantes', amount: '420', date: daysAgo(4), description: 'Restaurantes Diego (demo)', userKey: 'diego' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '450', date: daysAgo(2), description: 'Gasolina Diego (demo)', userKey: 'diego' },
  { entityName: 'Valeria', categoryName: 'Colegiaturas', amount: '2200', date: daysAgo(6), description: 'Colegiatura Valeria (demo)', userKey: 'valeria' },
  { entityName: 'Casa', categoryName: 'Supermercado', amount: '320', date: daysAgo(1), description: 'Supermercado Valeria (demo)', userKey: 'valeria' },
  { entityName: 'Emilia', categoryName: 'Útiles escolares', amount: '190', date: daysAgo(9), description: 'Útiles Emilia (demo)', userKey: 'emilia' },
  { entityName: 'Casa', categoryName: 'Suscripciones', amount: '199', date: daysAgo(3), description: 'Suscripciones Emilia (demo)', userKey: 'emilia' },
  { entityName: 'Sebastián', categoryName: 'Entretenimiento', amount: '240', date: daysAgo(7), description: 'Entretenimiento Sebastián (demo)', userKey: 'sebastian' },
  { entityName: 'Auto', categoryName: 'Mantenimiento auto', amount: '300', date: daysAgo(5), description: 'Mantenimiento Sebastián (demo)', userKey: 'sebastian' },
  { entityName: 'Daniela', categoryName: 'Farmacia', amount: '210', date: daysAgo(8), description: 'Farmacia Daniela (demo)', userKey: 'daniela' },
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '620', date: daysAgo(10), description: 'Servicios Daniela (demo)', userKey: 'daniela' },
  { entityName: 'Andrés', categoryName: 'Restaurantes', amount: '520', date: daysAgo(12), description: 'Restaurantes Andrés (demo)', userKey: 'andres' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '380', date: daysAgo(11), description: 'Gasolina Andrés (demo)', userKey: 'andres' },
  // mes previo (para ver delta)
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '980', date: daysAgo(35), description: 'Servicios (mes previo)', userKey: 'admin2' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '740', date: daysAgo(42), description: 'Gasolina (mes previo)', userKey: 'carlos' },
]

const SEED_ENTITY_OWNERS: {
  entityName: string
  owners: { userKey: string; sharePct?: number | null }[]
}[] = [
  // Casa: % esperado (quién debería cubrir). Real se calcula por quién registró los gastos.
  { entityName: 'Casa', owners: [{ userKey: 'admin2', sharePct: 55 }, { userKey: 'carlos', sharePct: 45 }] },
  // Comida: compartido entre TODOS (sin % = reparto igual).
  { entityName: 'Comida (Familia)', owners: DEMO_USERS.map((u) => ({ userKey: u.key, sharePct: null })) },
  // Autos
  { entityName: 'Auto', owners: [{ userKey: 'carlos', sharePct: 100 }] },
  { entityName: 'Auto (Mamá)', owners: [{ userKey: 'admin2', sharePct: null }] },
  // Mascota: 2 dueños 50/50
  { entityName: 'Pelusa', owners: [{ userKey: 'laura', sharePct: 50 }, { userKey: 'sofia', sharePct: 50 }] },
  // Ahorros (tipos)
  { entityName: 'Fondo de emergencia', owners: [{ userKey: 'admin2', sharePct: 60 }, { userKey: 'carlos', sharePct: 40 }] },
  { entityName: 'Retiro', owners: [{ userKey: 'admin2', sharePct: null }, { userKey: 'carlos', sharePct: null }] }, // reparto igual
  { entityName: 'Educación (Sofía)', owners: [{ userKey: 'admin2', sharePct: 50 }, { userKey: 'carlos', sharePct: 50 }] },
  { entityName: 'Educación (Mateo)', owners: [{ userKey: 'admin2', sharePct: 50 }, { userKey: 'carlos', sharePct: 50 }] },
  { entityName: 'Inversión', owners: [{ userKey: 'carlos', sharePct: 100 }] },
  { entityName: 'Vacaciones', owners: [{ userKey: 'admin2', sharePct: null }, { userKey: 'carlos', sharePct: null }] },
]

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede cargar datos ficticios', 403)

    const tag = familyTag(familyId)

    const result = await prisma.$transaction(async (tx) => {
      const demoUsers: { id: string; email: string; name: string | null; isFamilyAdmin: boolean; password: string }[] = []

      // 1) Usuarios demo + membresías (para probar roles / miembros)
      for (const u of DEMO_USERS) {
        const email = demoEmail(tag, u.key)
        const password = generatePassword()
        const passwordHash = await hashPassword(password)
        const createdOrUpdated = await tx.user.upsert({
          where: { email },
          create: { email, passwordHash, name: u.name, phone: null },
          update: { passwordHash, name: u.name },
          select: { id: true, email: true, name: true },
        })

        await tx.familyMember.upsert({
          where: { familyId_userId: { familyId, userId: createdOrUpdated.id } },
          create: { familyId, userId: createdOrUpdated.id, isFamilyAdmin: u.isFamilyAdmin },
          update: { isFamilyAdmin: u.isFamilyAdmin },
          select: { id: true },
        })

        demoUsers.push({
          id: createdOrUpdated.id,
          email: createdOrUpdated.email,
          name: createdOrUpdated.name,
          isFamilyAdmin: u.isFamilyAdmin,
          password,
        })
      }

      const demoUserIdByKey = new Map<string, string>()
      for (let i = 0; i < DEMO_USERS.length; i += 1) {
        const key = DEMO_USERS[i]!.key
        const id = demoUsers[i]!.id
        demoUserIdByKey.set(key, id)
      }

      const existingEntities = await tx.budgetEntity.findMany({
        where: { familyId },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: 'asc' },
      })
      const existingCategories = await tx.budgetCategory.findMany({
        where: { familyId },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: 'asc' },
      })

      const entityByName = new Map<string, { id: string; name: string; type: EntityType }>()
      for (const e of existingEntities) entityByName.set(norm(e.name), { id: e.id, name: e.name, type: e.type })

      const categoryByName = new Map<string, { id: string; name: string; type: string }>()
      for (const c of existingCategories) categoryByName.set(norm(c.name), { id: c.id, name: c.name, type: c.type })

      let createdEntities = 0
      for (const e of SEED_ENTITIES) {
        if (entityByName.has(norm(e.name))) continue
        const created = await tx.budgetEntity.create({
          data: {
            familyId,
            name: e.name,
            type: e.type,
            isActive: true,
            participatesInBudget: e.participatesInBudget,
            participatesInReports: e.participatesInReports,
          },
          select: { id: true, name: true, type: true },
        })
        entityByName.set(norm(created.name), created)
        createdEntities += 1
      }

      let createdCategories = 0
      for (const c of SEED_CATEGORIES) {
        if (categoryByName.has(norm(c.name))) continue
        const created = await tx.budgetCategory.create({
          data: { familyId, name: c.name, type: c.type, isActive: true },
          select: { id: true, name: true, type: true },
        })
        categoryByName.set(norm(created.name), created)
        createdCategories += 1
      }

      // 1.5) Responsables (dueños) por objeto (Esperado vs Real)
      // Seguridad: solo escribimos si el objeto no tiene responsables aún,
      // o si los responsables actuales pertenecen a los usuarios demo (evita pisar configuración real).
      const demoUserIdSet = new Set(demoUsers.map((u) => String(u.id)))
      let seededOwnerEntities = 0
      let seededOwnerRows = 0
      let skippedOwnerEntities = 0
      for (const spec of SEED_ENTITY_OWNERS) {
        const e = entityByName.get(norm(spec.entityName))
        if (!e) continue
        if (e.type === EntityType.PERSON) continue

        const desired = (spec.owners || [])
          .map((o) => {
            const userId = (o?.userKey && demoUserIdByKey.get(o.userKey)) || ''
            if (!userId) return null
            const sharePct = typeof o?.sharePct === 'number' && Number.isFinite(o.sharePct) ? Math.round(o.sharePct) : null
            return { userId, sharePct }
          })
          .filter(Boolean) as { userId: string; sharePct: number | null }[]

        // Normaliza %: si hay alguno definido, deben estar definidos todos y sumar 100.
        const provided = desired.filter((d) => d.sharePct !== null)
        if (provided.length > 0) {
          if (provided.length !== desired.length) {
            for (const d of desired) d.sharePct = null
          } else {
            const sum = desired.reduce((s, d) => s + (d.sharePct || 0), 0)
            if (sum !== 100) {
              // Fallback: reparto igual (evita datos incoherentes en demo)
              for (const d of desired) d.sharePct = null
            }
          }
        }

        // Evita duplicados por userId
        const seen = new Set<string>()
        const cleanDesired: { userId: string; sharePct: number | null }[] = []
        for (const d of desired) {
          if (!d.userId) continue
          if (seen.has(d.userId)) continue
          seen.add(d.userId)
          cleanDesired.push(d)
        }

        const existingOwners = await tx.budgetEntityOwner.findMany({
          where: { entityId: e.id },
          select: { userId: true },
        })
        const canOverwrite = existingOwners.length === 0 || existingOwners.every((o) => demoUserIdSet.has(String(o.userId)))
        if (!canOverwrite) {
          skippedOwnerEntities += 1
          continue
        }

        await tx.budgetEntityOwner.deleteMany({ where: { entityId: e.id } })
        if (cleanDesired.length) {
          await tx.budgetEntityOwner.createMany({
            data: cleanDesired.map((d) => ({
              familyId,
              entityId: e.id,
              userId: d.userId,
              sharePct: d.sharePct,
            })),
          })
          seededOwnerEntities += 1
          seededOwnerRows += cleanDesired.length
        }
      }

      const allocByKey = new Map<string, string>() // key -> allocationId
      let createdAllocations = 0
      for (const a of SEED_ALLOCATIONS) {
        const e = entityByName.get(norm(a.entityName))
        const c = categoryByName.get(norm(a.categoryName))
        if (!e || !c) continue
        const key = `${e.id}::${c.id}`

        const existingAlloc = await tx.entityBudgetAllocation.findFirst({
          where: { familyId, entityId: e.id, categoryId: c.id },
          select: { id: true },
        })
        if (existingAlloc) {
          allocByKey.set(key, existingAlloc.id)
          continue
        }

        const created = await tx.entityBudgetAllocation.create({
          data: {
            familyId,
            entityId: e.id,
            categoryId: c.id,
            monthlyLimit: a.monthlyLimit,
            isActive: true,
          },
          select: { id: true },
        })
        allocByKey.set(key, created.id)
        createdAllocations += 1
      }

      const txCount = await tx.transaction.count({ where: { familyId } })
      let createdTransactions = 0
      let firstTransactionId: string | null = null
      for (const t of SEED_TRANSACTIONS) {
        const e = entityByName.get(norm(t.entityName))
        const c = categoryByName.get(norm(t.categoryName))
        if (!e || !c) continue
        const key = `${e.id}::${c.id}`
        const allocationId = allocByKey.get(key)
        if (!allocationId) continue

        // Idempotente: si ya existe una transacción demo con misma descripción en esa asignación, no la duplicamos
        const existingTx = await tx.transaction.findFirst({
          where: { familyId, allocationId, description: t.description },
          select: { id: true },
        })
        if (existingTx) {
          if (!firstTransactionId) firstTransactionId = existingTx.id
          continue
        }

        const txUserId = (t.userKey && demoUserIdByKey.get(t.userKey)) || userId
        const createdTx = await tx.transaction.create({
          data: {
            familyId,
            userId: txUserId,
            allocationId,
            amount: t.amount,
            date: t.date,
            description: t.description,
          },
          select: { id: true },
        })
        if (!firstTransactionId) firstTransactionId = createdTx.id
        createdTransactions += 1
      }

      return {
        createdEntities,
        createdCategories,
        seededOwnerEntities,
        seededOwnerRows,
        skippedOwnerEntities,
        createdAllocations,
        createdTransactions,
        skippedTransactions: txCount > 0,
        demoUsers: demoUsers.map(({ id, ...rest }) => rest),
        receiptCandidateTransactionId: firstTransactionId,
      }
    })

    // 2) Recibo demo (best-effort). Si Spaces no está configurado, no falla el seed.
    let receipt: { created: boolean; skipped: boolean; reason?: string; receiptId?: string } = {
      created: false,
      skipped: true,
    }
    try {
      if (result.receiptCandidateTransactionId) {
        const receiptsCount = await prisma.receipt.count({ where: { familyId } })
        if (receiptsCount === 0) {
          const key = `receipts/${familyId}/${result.receiptCandidateTransactionId}/demo-${Date.now()}.txt`
          const body = Buffer.from('DOMUS+ — Recibo ficticio (demo)\n\nEste archivo es solo para pruebas.\n', 'utf8')
          const fileUrl = await uploadToSpaces({ key, body, contentType: 'text/plain; charset=utf-8' })
          const created = await prisma.receipt.create({
            data: {
              transactionId: result.receiptCandidateTransactionId,
              userId,
              familyId,
              fileUrl,
            },
            select: { id: true },
          })
          receipt = { created: true, skipped: false, receiptId: created.id }
        } else {
          receipt = { created: false, skipped: true, reason: 'Ya existen recibos en esta familia' }
        }
      } else {
        receipt = { created: false, skipped: true, reason: 'No hay transacciones para adjuntar un recibo' }
      }
    } catch (err: any) {
      receipt = { created: false, skipped: true, reason: err?.message || 'No se pudo crear el recibo demo' }
    }

    return NextResponse.json({ ok: true, ...result, receipt }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'No se pudieron cargar datos ficticios'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}


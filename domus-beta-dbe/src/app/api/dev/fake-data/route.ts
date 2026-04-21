import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityKind } from '@/generated/prisma/client'
import { getOrCreateServiceFromBudgetCategoryName } from '@/lib/budget/legacy-category-to-service'
import { hashPassword } from '@/lib/auth/password'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { generateRegistrationCode, type PrismaLike } from '@/lib/registration-code'
import { randomBytes } from 'node:crypto'

/** Obtiene URL para recibo demo: intenta Spaces; si falla usa data URL para que el seed cree recibos y consumo igual. */
async function getDemoReceiptFileUrl(familyId: string, transactionId: string, suffix: string): Promise<string> {
  try {
    const key = `receipts/${familyId}/${transactionId}/demo-${suffix}-${Date.now()}.txt`
    const body = Buffer.from('DOMUS+ — Recibo ficticio (demo)\n\nDatos de consumo para Reportes.\n', 'utf8')
    return await uploadToSpaces({ key, body, contentType: 'text/plain; charset=utf-8' })
  } catch {
    return `data:text/plain;base64,${Buffer.from('DOMUS+ demo').toString('base64')}`
  }
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

/** Fecha hace M meses, día D del mes (1-28). Para generar datos en un año completo. */
function dateMonthsAgo(monthsAgo: number, day = 15) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  d.setDate(Math.min(day, 28))
  d.setHours(0, 0, 0, 0)
  return d
}

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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
  type: EntityKind
  subtype: string | null
  participatesInBudget: boolean
  participatesInReports: boolean
}[] = [
  { name: 'Mamá', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Papá', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Laura', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Sofía', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Mateo', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Diego', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Valeria', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Emilia', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Sebastián', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Daniela', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Andrés', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Casa', type: EntityKind.ASSET, subtype: 'casa', participatesInBudget: true, participatesInReports: true },
  { name: 'Comida (Familia)', type: EntityKind.ASSET, subtype: 'familia', participatesInBudget: true, participatesInReports: true },
  { name: 'Auto', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Auto (Mamá)', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Moto', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Camioneta', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Bici familiar', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Pelusa', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Luna', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Max', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Nala', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Rocky', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Coco', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: false },
  { name: 'Fondo de emergencia', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Retiro', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Educación (Sofía)', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Educación (Mateo)', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Inversión', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Ahorro Navidad', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Ahorro carro nuevo', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Vacaciones', type: EntityKind.ASSET, subtype: 'proyecto', participatesInBudget: true, participatesInReports: true },
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
  { entityName: 'Moto', categoryName: 'Gasolina', monthlyLimit: '500' },
  { entityName: 'Moto', categoryName: 'Mantenimiento auto', monthlyLimit: '200' },
  { entityName: 'Camioneta', categoryName: 'Gasolina', monthlyLimit: '2200' },
  { entityName: 'Camioneta', categoryName: 'Mantenimiento auto', monthlyLimit: '800' },
  { entityName: 'Camioneta', categoryName: 'Seguro auto', monthlyLimit: '550' },
  { entityName: 'Bici familiar', categoryName: 'Mantenimiento auto', monthlyLimit: '150' },
  { entityName: 'Pelusa', categoryName: 'Mascotas', monthlyLimit: '600' },
  { entityName: 'Pelusa', categoryName: 'Veterinario', monthlyLimit: '300' },
  { entityName: 'Luna', categoryName: 'Mascotas', monthlyLimit: '450' },
  { entityName: 'Luna', categoryName: 'Veterinario', monthlyLimit: '250' },
  { entityName: 'Max', categoryName: 'Mascotas', monthlyLimit: '500' },
  { entityName: 'Max', categoryName: 'Veterinario', monthlyLimit: '280' },
  { entityName: 'Nala', categoryName: 'Mascotas', monthlyLimit: '400' },
  { entityName: 'Nala', categoryName: 'Veterinario', monthlyLimit: '200' },
  { entityName: 'Rocky', categoryName: 'Mascotas', monthlyLimit: '550' },
  { entityName: 'Rocky', categoryName: 'Veterinario', monthlyLimit: '320' },
  { entityName: 'Coco', categoryName: 'Mascotas', monthlyLimit: '380' },
  { entityName: 'Coco', categoryName: 'Veterinario', monthlyLimit: '180' },
  { entityName: 'Sofía', categoryName: 'Colegiaturas', monthlyLimit: '2500' },
  { entityName: 'Sofía', categoryName: 'Útiles escolares', monthlyLimit: '300' },
  { entityName: 'Mateo', categoryName: 'Colegiaturas', monthlyLimit: '2000' },
  { entityName: 'Mateo', categoryName: 'Útiles escolares', monthlyLimit: '300' },
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
  { entityName: 'Daniela', categoryName: 'Colegiaturas', monthlyLimit: '2300' },
  { entityName: 'Daniela', categoryName: 'Útiles escolares', monthlyLimit: '260' },
  { entityName: 'Daniela', categoryName: 'Salud / Doctor', monthlyLimit: '500' },
  { entityName: 'Daniela', categoryName: 'Farmacia', monthlyLimit: '250' },
  { entityName: 'Daniela', categoryName: 'Ropa', monthlyLimit: '450' },
  { entityName: 'Andrés', categoryName: 'Colegiaturas', monthlyLimit: '2600' },
  { entityName: 'Andrés', categoryName: 'Útiles escolares', monthlyLimit: '340' },
  { entityName: 'Andrés', categoryName: 'Restaurantes', monthlyLimit: '900' },
  { entityName: 'Andrés', categoryName: 'Ropa', monthlyLimit: '500' },
  { entityName: 'Andrés', categoryName: 'Suscripciones', monthlyLimit: '180' },
  { entityName: 'Laura', categoryName: 'Ahorro', monthlyLimit: '350' },
  { entityName: 'Sofía', categoryName: 'Ahorro', monthlyLimit: '200' },
  { entityName: 'Mateo', categoryName: 'Ahorro', monthlyLimit: '150' },
  { entityName: 'Casa', categoryName: 'Suscripciones', monthlyLimit: '250' },
  { entityName: 'Fondo de emergencia', categoryName: 'Ahorro', monthlyLimit: '2000' },
  { entityName: 'Retiro', categoryName: 'Ahorro', monthlyLimit: '2500' },
  { entityName: 'Educación (Sofía)', categoryName: 'Ahorro', monthlyLimit: '900' },
  { entityName: 'Educación (Mateo)', categoryName: 'Ahorro', monthlyLimit: '700' },
  { entityName: 'Inversión', categoryName: 'Ahorro', monthlyLimit: '1200' },
  { entityName: 'Ahorro Navidad', categoryName: 'Ahorro', monthlyLimit: '800' },
  { entityName: 'Ahorro carro nuevo', categoryName: 'Ahorro', monthlyLimit: '1500' },
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
  { entityName: 'Luna', categoryName: 'Mascotas', amount: '280', date: daysAgo(5), description: 'Alimento Luna', userKey: 'laura' },
  { entityName: 'Luna', categoryName: 'Veterinario', amount: '180', date: daysAgo(14), description: 'Vacunas Luna', userKey: 'sofia' },
  { entityName: 'Max', categoryName: 'Mascotas', amount: '320', date: daysAgo(4), description: 'Alimento Max', userKey: 'mateo' },
  { entityName: 'Max', categoryName: 'Veterinario', amount: '220', date: daysAgo(11), description: 'Consulta Max', userKey: 'admin2' },
  { entityName: 'Nala', categoryName: 'Mascotas', amount: '250', date: daysAgo(3), description: 'Alimento Nala', userKey: 'valeria' },
  { entityName: 'Rocky', categoryName: 'Mascotas', amount: '380', date: daysAgo(7), description: 'Alimento Rocky', userKey: 'carlos' },
  { entityName: 'Rocky', categoryName: 'Veterinario', amount: '290', date: daysAgo(9), description: 'Veterinario Rocky', userKey: 'admin2' },
  { entityName: 'Coco', categoryName: 'Mascotas', amount: '220', date: daysAgo(2), description: 'Alimento Coco', userKey: 'emilia' },
  { entityName: 'Moto', categoryName: 'Gasolina', amount: '280', date: daysAgo(6), description: 'Gasolina Moto', userKey: 'diego' },
  { entityName: 'Moto', categoryName: 'Mantenimiento auto', amount: '120', date: daysAgo(18), description: 'Mantenimiento Moto', userKey: 'diego' },
  { entityName: 'Camioneta', categoryName: 'Gasolina', amount: '1850', date: daysAgo(5), description: 'Gasolina Camioneta', userKey: 'carlos' },
  { entityName: 'Camioneta', categoryName: 'Mantenimiento auto', amount: '450', date: daysAgo(12), description: 'Cambio llantas Camioneta', userKey: 'carlos' },
  { entityName: 'Camioneta', categoryName: 'Seguro auto', amount: '550', date: daysAgo(1), description: 'Seguro Camioneta', userKey: 'admin2' },
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
  { entityName: 'Daniela', categoryName: 'Colegiaturas', amount: '2300', date: daysAgo(4), description: 'Colegiatura Daniela (demo)', userKey: 'daniela' },
  { entityName: 'Daniela', categoryName: 'Farmacia', amount: '210', date: daysAgo(8), description: 'Farmacia Daniela (demo)', userKey: 'daniela' },
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '620', date: daysAgo(10), description: 'Servicios Daniela (demo)', userKey: 'daniela' },
  { entityName: 'Andrés', categoryName: 'Colegiaturas', amount: '2600', date: daysAgo(3), description: 'Colegiatura Andrés (demo)', userKey: 'andres' },
  { entityName: 'Andrés', categoryName: 'Restaurantes', amount: '520', date: daysAgo(12), description: 'Restaurantes Andrés (demo)', userKey: 'andres' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '380', date: daysAgo(11), description: 'Gasolina Andrés (demo)', userKey: 'andres' },
  { entityName: 'Laura', categoryName: 'Ahorro', amount: '300', date: daysAgo(7), description: 'Ahorro Laura', userKey: 'laura' },
  { entityName: 'Ahorro Navidad', categoryName: 'Ahorro', amount: '600', date: daysAgo(5), description: 'Aportación ahorro Navidad', userKey: 'admin2' },
  { entityName: 'Ahorro Navidad', categoryName: 'Ahorro', amount: '400', date: daysAgo(8), description: 'Aportación ahorro Navidad (Papá)', userKey: 'carlos' },
  { entityName: 'Ahorro carro nuevo', categoryName: 'Ahorro', amount: '1000', date: daysAgo(6), description: 'Ahorro carro nuevo', userKey: 'carlos' },
  { entityName: 'Ahorro carro nuevo', categoryName: 'Ahorro', amount: '500', date: daysAgo(10), description: 'Ahorro carro nuevo (Mamá)', userKey: 'admin2' },
  // mes previo (para ver delta)
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '980', date: daysAgo(35), description: 'Servicios (mes previo)', userKey: 'admin2' },
  { entityName: 'Auto', categoryName: 'Gasolina', amount: '740', date: daysAgo(42), description: 'Gasolina (mes previo)', userKey: 'carlos' },
]

/** Genera transacciones para 12 meses: renta, servicios, gasolina, veterinario, reparaciones, vacaciones, colegiaturas, etc. Objetivo: evaluar periodo completo y ver conflictos (límites, reparto, gastos irregulares). */
function buildSeedTransactions12Months(): {
  entityName: string
  categoryName: string
  amount: string
  date: Date
  description: string
  userKey: string
}[] {
  const out: { entityName: string; categoryName: string; amount: string; date: Date; description: string; userKey: string }[] = []
  const users = ['admin2', 'carlos', 'laura', 'sofia', 'mateo', 'diego', 'valeria', 'emilia', 'sebastian', 'daniela', 'andres'] as const

  for (let m = 0; m < 12; m++) {
    const mes = MONTH_NAMES[m]!
    const date = (d: number) => dateMonthsAgo(m, d)

    out.push({ entityName: 'Casa', categoryName: 'Renta / Hipoteca', amount: '11800', date: date(5), description: `Renta ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: m === 6 || m === 7 ? '1850' : '920', date: date(10), description: `Luz/agua ${mes}`, userKey: m % 2 ? 'carlos' : 'admin2' })
    out.push({ entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '120', date: date(11), description: `Agua ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Casa', categoryName: 'Internet / Teléfono', amount: '699', date: date(8), description: `Internet ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Casa', categoryName: 'Limpieza / Hogar', amount: '420', date: date(12), description: `Limpieza ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Casa', categoryName: 'Suscripciones', amount: '199', date: date(1), description: `Streaming ${mes}`, userKey: 'carlos' })
    if (m % 4 === 2) out.push({ entityName: 'Casa', categoryName: 'Reparaciones de casa', amount: m === 2 ? '3200' : '580', date: date(14), description: `Reparación casa ${mes}`, userKey: 'admin2' })

    out.push({ entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '1280', date: date(3), description: `Super semana 1 ${mes}`, userKey: users[m % users.length]! })
    out.push({ entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '1150', date: date(10), description: `Super semana 2 ${mes}`, userKey: users[(m + 2) % users.length]! })
    out.push({ entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '980', date: date(18), description: `Super semana 3 ${mes}`, userKey: 'admin2' })
    if (m % 2 === 0) out.push({ entityName: 'Comida (Familia)', categoryName: 'Restaurantes', amount: '450', date: date(15), description: `Comida fuera ${mes}`, userKey: 'sofia' })
    out.push({ entityName: 'Comida (Familia)', categoryName: 'Restaurantes', amount: '280', date: date(22), description: `Café/antojitos ${mes}`, userKey: 'mateo' })

    out.push({ entityName: 'Auto', categoryName: 'Gasolina', amount: '850', date: date(5), description: `Gasolina Auto ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Auto', categoryName: 'Gasolina', amount: '720', date: date(20), description: `Gasolina Auto 2 ${mes}`, userKey: 'carlos' })
    if (m % 3 === 0) out.push({ entityName: 'Auto', categoryName: 'Mantenimiento auto', amount: '550', date: date(12), description: `Mantenimiento Auto ${mes}`, userKey: 'carlos' })
    if (m % 6 === 0) out.push({ entityName: 'Auto', categoryName: 'Seguro auto', amount: '2400', date: date(1), description: `Seguro Auto semestral ${mes}`, userKey: 'carlos' })

    out.push({ entityName: 'Auto (Mamá)', categoryName: 'Gasolina', amount: '480', date: date(7), description: `Gasolina Auto Mamá ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Auto (Mamá)', categoryName: 'Gasolina', amount: '520', date: date(21), description: `Gasolina Auto Mamá 2 ${mes}`, userKey: 'admin2' })
    if (m % 12 === 0) out.push({ entityName: 'Auto (Mamá)', categoryName: 'Seguro auto', amount: '3000', date: date(1), description: 'Seguro Auto Mamá anual', userKey: 'admin2' })

    out.push({ entityName: 'Moto', categoryName: 'Gasolina', amount: '280', date: date(8), description: `Gasolina Moto ${mes}`, userKey: 'diego' })
    if (m % 4 === 1) out.push({ entityName: 'Moto', categoryName: 'Mantenimiento auto', amount: '120', date: date(14), description: `Mantenimiento Moto ${mes}`, userKey: 'diego' })

    out.push({ entityName: 'Camioneta', categoryName: 'Gasolina', amount: '1900', date: date(4), description: `Gasolina Camioneta ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Camioneta', categoryName: 'Gasolina', amount: '1750', date: date(18), description: `Gasolina Camioneta 2 ${mes}`, userKey: 'carlos' })
    if (m % 6 === 3) out.push({ entityName: 'Camioneta', categoryName: 'Mantenimiento auto', amount: '850', date: date(10), description: `Mantenimiento Camioneta ${mes}`, userKey: 'carlos' })
    if (m === 5) out.push({ entityName: 'Camioneta', categoryName: 'Seguro auto', amount: '3200', date: date(1), description: 'Seguro Camioneta semestral', userKey: 'admin2' })

    out.push({ entityName: 'Pelusa', categoryName: 'Mascotas', amount: '380', date: date(6), description: `Croquetas Pelusa ${mes}`, userKey: 'laura' })
    if (m === 2 || m === 8) out.push({ entityName: 'Pelusa', categoryName: 'Veterinario', amount: '420', date: date(12), description: `Vet Pelusa ${mes}`, userKey: 'sofia' })
    out.push({ entityName: 'Luna', categoryName: 'Mascotas', amount: '260', date: date(8), description: `Alimento Luna ${mes}`, userKey: 'laura' })
    if (m === 1) out.push({ entityName: 'Luna', categoryName: 'Veterinario', amount: '180', date: date(15), description: 'Vacunas Luna', userKey: 'sofia' })
    out.push({ entityName: 'Max', categoryName: 'Mascotas', amount: '320', date: date(10), description: `Alimento Max ${mes}`, userKey: 'mateo' })
    if (m === 4) out.push({ entityName: 'Max', categoryName: 'Veterinario', amount: '650', date: date(7), description: 'Consulta urgente Max', userKey: 'admin2' })
    out.push({ entityName: 'Nala', categoryName: 'Mascotas', amount: '250', date: date(5), description: `Alimento Nala ${mes}`, userKey: 'valeria' })
    if (m === 10) out.push({ entityName: 'Nala', categoryName: 'Veterinario', amount: '190', date: date(20), description: 'Vet Nala', userKey: 'valeria' })
    out.push({ entityName: 'Rocky', categoryName: 'Mascotas', amount: '400', date: date(12), description: `Alimento Rocky ${mes}`, userKey: 'carlos' })
    if (m === 6) out.push({ entityName: 'Rocky', categoryName: 'Veterinario', amount: '380', date: date(8), description: 'Vet Rocky', userKey: 'admin2' })
    out.push({ entityName: 'Coco', categoryName: 'Mascotas', amount: '220', date: date(14), description: `Alimento Coco ${mes}`, userKey: 'emilia' })
    if (m === 3) out.push({ entityName: 'Coco', categoryName: 'Veterinario', amount: '210', date: date(22), description: 'Vet Coco', userKey: 'emilia' })

    if (m >= 7 && m <= 10) out.push({ entityName: 'Sofía', categoryName: 'Colegiaturas', amount: '2500', date: date(5), description: `Colegiatura Sofía ${mes}`, userKey: 'admin2' })
    if (m === 7 || m === 0) out.push({ entityName: 'Sofía', categoryName: 'Útiles escolares', amount: '320', date: date(15), description: `Útiles Sofía ${mes}`, userKey: 'sofia' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Mateo', categoryName: 'Colegiaturas', amount: '2000', date: date(6), description: `Colegiatura Mateo ${mes}`, userKey: 'admin2' })
    if (m === 7 || m === 0) out.push({ entityName: 'Mateo', categoryName: 'Útiles escolares', amount: '280', date: date(16), description: `Útiles Mateo ${mes}`, userKey: 'admin2' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Valeria', categoryName: 'Colegiaturas', amount: '2200', date: date(5), description: `Colegiatura Valeria ${mes}`, userKey: 'valeria' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Emilia', categoryName: 'Colegiaturas', amount: '2100', date: date(6), description: `Colegiatura Emilia ${mes}`, userKey: 'emilia' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Sebastián', categoryName: 'Colegiaturas', amount: '2400', date: date(5), description: `Colegiatura Sebastián ${mes}`, userKey: 'sebastian' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Daniela', categoryName: 'Colegiaturas', amount: '2300', date: date(6), description: `Colegiatura Daniela ${mes}`, userKey: 'daniela' })
    if (m >= 7 && m <= 10) out.push({ entityName: 'Andrés', categoryName: 'Colegiaturas', amount: '2600', date: date(5), description: `Colegiatura Andrés ${mes}`, userKey: 'andres' })
    if (m === 7) out.push({ entityName: 'Valeria', categoryName: 'Útiles escolares', amount: '290', date: date(18), description: 'Útiles Valeria', userKey: 'valeria' })
    if (m === 7) out.push({ entityName: 'Daniela', categoryName: 'Útiles escolares', amount: '260', date: date(17), description: 'Útiles Daniela', userKey: 'daniela' })
    if (m === 7) out.push({ entityName: 'Andrés', categoryName: 'Útiles escolares', amount: '340', date: date(19), description: 'Útiles Andrés', userKey: 'andres' })

    if (m !== 1) out.push({ entityName: 'Mamá', categoryName: 'Salud / Doctor', amount: '350', date: date(9), description: `Consulta Mamá ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Mamá', categoryName: 'Farmacia', amount: '180', date: date(11), description: `Farmacia Mamá ${mes}`, userKey: 'laura' })
    out.push({ entityName: 'Mamá', categoryName: 'Ahorro', amount: '450', date: date(2), description: `Ahorro Mamá ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Papá', categoryName: 'Ahorro', amount: '400', date: date(3), description: `Ahorro Papá ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Papá', categoryName: 'Restaurantes', amount: '380', date: date(14), description: `Restaurantes Papá ${mes}`, userKey: 'carlos' })
    if (m % 2 === 0) out.push({ entityName: 'Papá', categoryName: 'Ropa', amount: '420', date: date(20), description: `Ropa Papá ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Laura', categoryName: 'Entretenimiento', amount: '220', date: date(8), description: `Entretenimiento Laura ${mes}`, userKey: 'laura' })
    out.push({ entityName: 'Laura', categoryName: 'Suscripciones', amount: '199', date: date(1), description: `Suscripción Laura ${mes}`, userKey: 'laura' })
    out.push({ entityName: 'Laura', categoryName: 'Ahorro', amount: '300', date: date(5), description: `Ahorro Laura ${mes}`, userKey: 'laura' })
    out.push({ entityName: 'Diego', categoryName: 'Restaurantes', amount: '350', date: date(12), description: `Restaurantes Diego ${mes}`, userKey: 'diego' })
    if (m % 3 === 0) out.push({ entityName: 'Diego', categoryName: 'Ropa', amount: '380', date: date(16), description: `Ropa Diego ${mes}`, userKey: 'diego' })
    out.push({ entityName: 'Sebastián', categoryName: 'Entretenimiento', amount: '280', date: date(10), description: `Entretenimiento Sebastián ${mes}`, userKey: 'sebastian' })
    out.push({ entityName: 'Daniela', categoryName: 'Farmacia', amount: '190', date: date(7), description: `Farmacia Daniela ${mes}`, userKey: 'daniela' })
    if (m % 2 === 1) out.push({ entityName: 'Daniela', categoryName: 'Salud / Doctor', amount: '450', date: date(13), description: `Doctor Daniela ${mes}`, userKey: 'daniela' })
    out.push({ entityName: 'Andrés', categoryName: 'Restaurantes', amount: '420', date: date(15), description: `Restaurantes Andrés ${mes}`, userKey: 'andres' })
    if (m === 11) out.push({ entityName: 'Andrés', categoryName: 'Suscripciones', amount: '180', date: date(20), description: 'Suscripción Andrés dic', userKey: 'andres' })

    out.push({ entityName: 'Fondo de emergencia', categoryName: 'Ahorro', amount: '1000', date: date(5), description: `Fondo emergencia ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Fondo de emergencia', categoryName: 'Ahorro', amount: '600', date: date(12), description: `Fondo Papá ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Retiro', categoryName: 'Ahorro', amount: '1200', date: date(6), description: `Ahorro retiro ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Retiro', categoryName: 'Ahorro', amount: '900', date: date(14), description: `Ahorro retiro Mamá ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Educación (Sofía)', categoryName: 'Ahorro', amount: '600', date: date(7), description: `Ahorro educación Sofía ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Educación (Mateo)', categoryName: 'Ahorro', amount: '500', date: date(8), description: `Ahorro educación Mateo ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Inversión', categoryName: 'Ahorro', amount: '900', date: date(10), description: `Inversión ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Ahorro Navidad', categoryName: 'Ahorro', amount: '550', date: date(5), description: `Ahorro Navidad ${mes}`, userKey: 'admin2' })
    out.push({ entityName: 'Ahorro Navidad', categoryName: 'Ahorro', amount: '350', date: date(15), description: `Ahorro Navidad Papá ${mes}`, userKey: 'carlos' })
    out.push({ entityName: 'Ahorro carro nuevo', categoryName: 'Ahorro', amount: '800', date: date(9), description: `Ahorro carro ${mes}`, userKey: 'carlos' })
    if (m % 2 === 0) out.push({ entityName: 'Ahorro carro nuevo', categoryName: 'Ahorro', amount: '500', date: date(18), description: `Ahorro carro Mamá ${mes}`, userKey: 'admin2' })

    if (m === 6) out.push({ entityName: 'Vacaciones', categoryName: 'Vacaciones', amount: '18500', date: date(12), description: 'Viaje verano (vuelo + hotel)', userKey: 'admin2' })
    if (m === 11) out.push({ entityName: 'Vacaciones', categoryName: 'Vacaciones', amount: '8200', date: date(22), description: 'Vacaciones Navidad', userKey: 'carlos' })
    if (m === 3) out.push({ entityName: 'Vacaciones', categoryName: 'Vacaciones', amount: '4500', date: date(5), description: 'Semana Santa (casa playa)', userKey: 'admin2' })
    if (m !== 6 && m !== 11 && m !== 3) out.push({ entityName: 'Vacaciones', categoryName: 'Vacaciones', amount: '750', date: date(1), description: `Ahorro vacaciones ${mes}`, userKey: 'carlos' })

    if (m === 6) out.push({ entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '1450', date: date(25), description: 'Super extra fiestas julio', userKey: 'admin2' })
    if (m === 11) out.push({ entityName: 'Comida (Familia)', categoryName: 'Supermercado', amount: '2100', date: date(20), description: 'Super Navidad (extra)', userKey: 'carlos' })
    if (m === 9) out.push({ entityName: 'Auto', categoryName: 'Gasolina', amount: '1100', date: date(28), description: 'Gasolina viaje largo oct', userKey: 'carlos' })
  }
  return out
}

const SEED_TRANSACTIONS_12M = buildSeedTransactions12Months()

// Transacciones solo para recibos de consumo (luz/agua) — se crean si no existen por descripción
const SEED_UTILITY_TRANSACTIONS: {
  entityName: string
  categoryName: string
  amount: string
  date: Date
  description: string
  userKey: string
}[] = [
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '450', date: daysAgo(8), description: 'Recibo CFE (demo)', userKey: 'admin2' },
  { entityName: 'Casa', categoryName: 'Servicios (luz/agua/internet)', amount: '120', date: daysAgo(10), description: 'Recibo Agua (demo)', userKey: 'carlos' },
]

// Productos con cantidad/unidad para el recibo super (Reportes > Consumo)
const SEED_CONSUMPTION_ITEMS: { description: string; quantity: number; quantityUnit: string }[] = [
  { description: 'LECHE ENTERA 1L', quantity: 2, quantityUnit: 'L' },
  { description: 'PASTA SPAGHETTI 450G', quantity: 2, quantityUnit: 'g' },
  { description: 'MAYONESA 500G', quantity: 1, quantityUnit: 'g' },
  { description: 'AGUA MINERAL 6.1L', quantity: 1, quantityUnit: 'L' },
  { description: 'ACEITE 900ML', quantity: 1, quantityUnit: 'ml' },
  { description: 'ARROZ 1KG', quantity: 2, quantityUnit: 'kg' },
  { description: 'JABÓN DOVE 12/1L', quantity: 1, quantityUnit: 'L' },
  { description: 'AZÚCAR 2KG', quantity: 1, quantityUnit: 'kg' },
  { description: 'DETERGENTE 2L', quantity: 1, quantityUnit: 'L' },
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
  { entityName: 'Moto', owners: [{ userKey: 'diego', sharePct: 100 }] },
  { entityName: 'Camioneta', owners: [{ userKey: 'carlos', sharePct: 60 }, { userKey: 'admin2', sharePct: 40 }] },
  { entityName: 'Bici familiar', owners: [{ userKey: 'admin2', sharePct: null }, { userKey: 'carlos', sharePct: null }] },
  // Mascotas
  { entityName: 'Pelusa', owners: [{ userKey: 'laura', sharePct: 50 }, { userKey: 'sofia', sharePct: 50 }] },
  { entityName: 'Luna', owners: [{ userKey: 'laura', sharePct: 100 }] },
  { entityName: 'Max', owners: [{ userKey: 'mateo', sharePct: 100 }] },
  { entityName: 'Nala', owners: [{ userKey: 'valeria', sharePct: 100 }] },
  { entityName: 'Rocky', owners: [{ userKey: 'carlos', sharePct: 50 }, { userKey: 'admin2', sharePct: 50 }] },
  { entityName: 'Coco', owners: [{ userKey: 'emilia', sharePct: 100 }] },
  // Ahorros (tipos)
  { entityName: 'Fondo de emergencia', owners: [{ userKey: 'admin2', sharePct: 60 }, { userKey: 'carlos', sharePct: 40 }] },
  { entityName: 'Retiro', owners: [{ userKey: 'admin2', sharePct: null }, { userKey: 'carlos', sharePct: null }] }, // reparto igual
  { entityName: 'Educación (Sofía)', owners: [{ userKey: 'admin2', sharePct: 50 }, { userKey: 'carlos', sharePct: 50 }] },
  { entityName: 'Educación (Mateo)', owners: [{ userKey: 'admin2', sharePct: 50 }, { userKey: 'carlos', sharePct: 50 }] },
  { entityName: 'Inversión', owners: [{ userKey: 'carlos', sharePct: 100 }] },
  { entityName: 'Ahorro Navidad', owners: [{ userKey: 'admin2', sharePct: null }, { userKey: 'carlos', sharePct: null }] },
  { entityName: 'Ahorro carro nuevo', owners: [{ userKey: 'carlos', sharePct: 60 }, { userKey: 'admin2', sharePct: 40 }] },
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

      const existingEntities = await tx.entity.findMany({
        where: { familyId },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: 'asc' },
      })
      const existingCategories = await tx.budgetCategory.findMany({
        where: { familyId },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: 'asc' },
      })

      const entityByName = new Map<string, { id: string; name: string; type: EntityKind }>()
      for (const e of existingEntities) entityByName.set(norm(e.name), { id: e.id, name: e.name, type: e.type })

      const categoryByName = new Map<string, { id: string; name: string; type: string }>()
      for (const c of existingCategories) categoryByName.set(norm(c.name), { id: c.id, name: c.name, type: c.type })

      let createdEntities = 0
      for (const e of SEED_ENTITIES) {
        if (entityByName.has(norm(e.name))) continue
        const created = await tx.entity.create({
          data: {
            familyId,
            name: e.name,
            type: e.type,
            subtype: e.subtype,
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
        if (e.type === EntityKind.PERSON) continue

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

        const existingOwners = await tx.entityOwner.findMany({
          where: { entityId: e.id },
          select: { userId: true },
        })
        const canOverwrite = existingOwners.length === 0 || existingOwners.every((o) => demoUserIdSet.has(String(o.userId)))
        if (!canOverwrite) {
          skippedOwnerEntities += 1
          continue
        }

        await tx.entityOwner.deleteMany({ where: { entityId: e.id } })
        if (cleanDesired.length) {
          await tx.entityOwner.createMany({
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

      const allocByKey = new Map<string, string>() // key -> budgetAccountId
      let createdAllocations = 0
      for (const a of SEED_ALLOCATIONS) {
        const e = entityByName.get(norm(a.entityName))
        const c = categoryByName.get(norm(a.categoryName))
        if (!e || !c) continue
        const svc = await getOrCreateServiceFromBudgetCategoryName(tx, c.name)
        await tx.entityService.upsert({
          where: { entityId_serviceId: { entityId: e.id, serviceId: svc.id } },
          create: { familyId, entityId: e.id, serviceId: svc.id, isActive: true },
          update: { isActive: true },
        })
        const key = `${e.id}::${svc.id}`

        const existingAlloc = await tx.budgetAccount.findFirst({
          where: { familyId, entityId: e.id, serviceId: svc.id },
          select: { id: true },
        })
        if (existingAlloc) {
          allocByKey.set(key, existingAlloc.id)
          continue
        }

        const created = await tx.budgetAccount.create({
          data: {
            familyId,
            entityId: e.id,
            serviceId: svc.id,
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
      let createdTransactions12M = 0
      let firstTransactionId: string | null = null

      // 1) Transacciones demo básicas: idempotente por descripción en la asignación
      for (const t of SEED_TRANSACTIONS) {
        const e = entityByName.get(norm(t.entityName))
        const c = categoryByName.get(norm(t.categoryName))
        if (!e || !c) continue
        const svc = await getOrCreateServiceFromBudgetCategoryName(tx, c.name)
        const key = `${e.id}::${svc.id}`
        const budgetAccountId = allocByKey.get(key)
        if (!budgetAccountId) continue
        const existingTx = await tx.transaction.findFirst({
          where: { familyId, budgetAccountId, description: t.description },
          select: { id: true },
        })
        if (existingTx) {
          if (!firstTransactionId) firstTransactionId = existingTx.id
          continue
        }
        const txUserId = (t.userKey && demoUserIdByKey.get(t.userKey)) || userId
        const registrationCode = await generateRegistrationCode(tx as PrismaLike, familyId, 'E')
        const createdTx = await tx.transaction.create({
          data: {
            familyId,
            userId: txUserId,
            budgetAccountId,
            amount: t.amount,
            date: t.date,
            description: t.description,
            registrationCode,
          },
          select: { id: true },
        })
        if (!firstTransactionId) firstTransactionId = createdTx.id
        createdTransactions += 1
      }

      // 2) Historial 12 meses: idempotente solo por descripción (cada mes tiene descripción única: "Renta ene", "Renta feb", etc.)
      let skipped12MNoAlloc = 0
      let skipped12MExists = 0
      for (const t of SEED_TRANSACTIONS_12M) {
        const e = entityByName.get(norm(t.entityName))
        const c = categoryByName.get(norm(t.categoryName))
        if (!e || !c) {
          skipped12MNoAlloc += 1
          continue
        }
        const svc12 = await getOrCreateServiceFromBudgetCategoryName(tx, c.name)
        const key = `${e.id}::${svc12.id}`
        const budgetAccountId12 = allocByKey.get(key)
        if (!budgetAccountId12) {
          skipped12MNoAlloc += 1
          continue
        }
        const existingTx = await tx.transaction.findFirst({
          where: { familyId, budgetAccountId: budgetAccountId12, description: t.description },
          select: { id: true },
        })
        if (existingTx) {
          skipped12MExists += 1
          if (!firstTransactionId) firstTransactionId = existingTx.id
          continue
        }
        const txUserId = (t.userKey && demoUserIdByKey.get(t.userKey)) || userId
        const registrationCode = await generateRegistrationCode(tx as PrismaLike, familyId, 'E')
        const createdTx = await tx.transaction.create({
          data: {
            familyId,
            userId: txUserId,
            budgetAccountId: budgetAccountId12,
            amount: t.amount,
            date: t.date,
            description: t.description,
            registrationCode,
          },
          select: { id: true },
        })
        if (!firstTransactionId) firstTransactionId = createdTx.id
        createdTransactions += 1
        createdTransactions12M += 1
      }

      // Transacciones para recibos de consumo (luz/agua) — idempotente por descripción
      const utilityTransactionIds: string[] = []
      for (const t of SEED_UTILITY_TRANSACTIONS) {
        const e = entityByName.get(norm(t.entityName))
        const c = categoryByName.get(norm(t.categoryName))
        if (!e || !c) continue
        const svc = await getOrCreateServiceFromBudgetCategoryName(tx, c.name)
        const key = `${e.id}::${svc.id}`
        const budgetAccountId = allocByKey.get(key)
        if (!budgetAccountId) continue
        const existingTx = await tx.transaction.findFirst({
          where: { familyId, budgetAccountId, description: t.description },
          select: { id: true },
        })
        if (existingTx) {
          utilityTransactionIds.push(existingTx.id)
          continue
        }
        const txUserId = (t.userKey && demoUserIdByKey.get(t.userKey)) || userId
        const registrationCode = await generateRegistrationCode(tx as PrismaLike, familyId, 'E')
        const createdTx = await tx.transaction.create({
          data: {
            familyId,
            userId: txUserId,
            budgetAccountId,
            amount: t.amount,
            date: t.date,
            description: t.description,
            registrationCode,
          },
          select: { id: true },
        })
        utilityTransactionIds.push(createdTx.id)
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
        createdTransactions12M,
        skipped12MNoAlloc,
        skipped12MExists,
        skippedTransactions: txCount > 0,
        demoUsers: demoUsers.map(({ id, ...rest }) => rest),
        receiptCandidateTransactionId: firstTransactionId,
        utilityTransactionIds,
        seedHint:
          createdTransactions12M === 0 && SEED_TRANSACTIONS_12M.length > 0
            ? `Ninguna transacción de 12 meses creada: ${skipped12MNoAlloc} sin partida, ${skipped12MExists} ya existían. Asegúrate de tener partidas (Configuración > Partidas) para Casa, Comida, Auto, etc.`
            : undefined,
      }
    })

    // 2) Recibos demo (best-effort). Si Spaces no está configurado, no falla el seed.
    let receipt: { created: boolean; skipped: boolean; reason?: string; receiptId?: string } = {
      created: false,
      skipped: true,
    }
    let superReceiptId: string | null = null
    const utilityReceiptIds: string[] = [] // [CFE, Agua] en ese orden
    try {
      if (result.receiptCandidateTransactionId) {
        const receiptsCount = await prisma.receipt.count({ where: { familyId } })
        if (receiptsCount === 0) {
          const fileUrl = await getDemoReceiptFileUrl(familyId, result.receiptCandidateTransactionId, 'super')
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
          superReceiptId = created.id
        } else {
          receipt = { created: false, skipped: true, reason: 'Ya existen recibos en esta familia' }
          // Usar el primer recibo que aún no tenga extracción para añadir datos de consumo (productos)
          const firstWithoutExtraction = await prisma.receipt.findFirst({
            where: { familyId, extraction: null },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
          if (firstWithoutExtraction) superReceiptId = firstWithoutExtraction.id
        }
      } else {
        receipt = { created: false, skipped: true, reason: 'No hay transacciones para adjuntar un recibo' }
      }

      // Recibos de luz y agua (consumo): crear si no existen, en orden [CFE, Agua]
      const utilityIds = (result as { utilityTransactionIds?: string[] }).utilityTransactionIds || []
      if (utilityIds.length >= 2) {
        let utilityFileUrl: string | null = null
        for (let i = 0; i < utilityIds.length; i += 1) {
          const txId = utilityIds[i]
          const existing = await prisma.receipt.findFirst({ where: { transactionId: txId }, select: { id: true } })
          if (existing) {
            utilityReceiptIds.push(existing.id)
            continue
          }
          if (!utilityFileUrl) {
            utilityFileUrl = await getDemoReceiptFileUrl(familyId, txId, 'utility')
          }
          const created = await prisma.receipt.create({
            data: { transactionId: txId, userId, familyId, fileUrl: utilityFileUrl },
            select: { id: true },
          })
          utilityReceiptIds.push(created.id)
        }
      }

      // Extracciones de consumo: super (productos), luz, agua — una por recibo si ese recibo aún no tiene
      const periodStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
      const periodEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      if (superReceiptId) {
        const exists = await prisma.receiptExtraction.findUnique({ where: { receiptId: superReceiptId }, select: { id: true } })
        if (!exists) {
          await prisma.receiptExtraction.create({
            data: {
              receiptId: superReceiptId,
              familyId,
              userId,
              merchantName: 'Super Demo',
              receiptDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              total: '1350',
              currency: 'MXN',
              rawText: SEED_CONSUMPTION_ITEMS.map((i) => `${i.description} ${i.quantity} ${i.quantityUnit}`).join('\n'),
              receiptType: 'retail',
              items: {
                create: SEED_CONSUMPTION_ITEMS.map((it, idx) => ({
                  lineNumber: idx + 1,
                  description: it.description,
                  rawLine: `${it.description} ${it.quantity} ${it.quantityUnit}`,
                  quantity: it.quantity,
                  unitPrice: null,
                  amount: null,
                  isAdjustment: false,
                  isPlaceholder: false,
                  quantityUnit: it.quantityUnit,
                })),
              },
            },
          })
        }
      }
      if (utilityReceiptIds.length >= 2) {
        const exists0 = await prisma.receiptExtraction.findUnique({ where: { receiptId: utilityReceiptIds[0] }, select: { id: true } })
        if (!exists0) {
          await prisma.receiptExtraction.create({
            data: {
              receiptId: utilityReceiptIds[0],
              familyId,
              userId,
              merchantName: 'CFE (demo)',
              receiptDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
              total: '450',
              currency: 'MXN',
              receiptType: 'utility',
              consumptionQuantity: '285',
              consumptionUnit: 'kWh',
              consumptionPeriodStart: periodStart,
              consumptionPeriodEnd: periodEnd,
            },
          })
        }
        const exists1 = await prisma.receiptExtraction.findUnique({ where: { receiptId: utilityReceiptIds[1] }, select: { id: true } })
        if (!exists1) {
          await prisma.receiptExtraction.create({
            data: {
              receiptId: utilityReceiptIds[1],
              familyId,
              userId,
              merchantName: 'Agua (demo)',
              receiptDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              total: '120',
              currency: 'MXN',
              receiptType: 'utility',
              consumptionQuantity: '12.5',
              consumptionUnit: 'm3',
              consumptionPeriodStart: periodStart,
              consumptionPeriodEnd: periodEnd,
            },
          })
        }
      }

      // Consumo 12 meses: recibos + extracciones para "Luz/agua {mes}" (kWh) y "Agua {mes}" (m³) para Reportes > Consumo
      const luzTx = await prisma.transaction.findMany({
        where: { familyId, description: { startsWith: 'Luz/agua ' } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      })
      const aguaTx = await prisma.transaction.findMany({
        where: { familyId, description: { startsWith: 'Agua ' } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      })
      for (const tx of luzTx) {
        const existingRec = await prisma.receipt.findFirst({ where: { transactionId: tx.id }, select: { id: true } })
        if (existingRec) {
          const hasExt = await prisma.receiptExtraction.findUnique({ where: { receiptId: existingRec.id }, select: { id: true } })
          if (hasExt) continue
        }
        const recId = existingRec?.id ?? (
          await prisma.receipt.create({
            data: {
              transactionId: tx.id,
              userId,
              familyId,
              fileUrl: await getDemoReceiptFileUrl(familyId, tx.id, `luz-${tx.date.toISOString().slice(0, 7)}`),
            },
            select: { id: true },
          })
        ).id
        if (!existingRec || !(await prisma.receiptExtraction.findUnique({ where: { receiptId: recId }, select: { id: true } }))) {
          const d = new Date(tx.date)
          const start = new Date(d.getFullYear(), d.getMonth(), 1)
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          await prisma.receiptExtraction.create({
            data: {
              receiptId: recId,
              familyId,
              userId,
              merchantName: 'CFE',
              receiptDate: tx.date,
              total: '920',
              currency: 'MXN',
              receiptType: 'utility',
              consumptionQuantity: String(180 + Math.floor(d.getMonth() * 8)),
              consumptionUnit: 'kWh',
              consumptionPeriodStart: start,
              consumptionPeriodEnd: end,
            },
          })
        }
      }
      for (const tx of aguaTx) {
        const existingRec = await prisma.receipt.findFirst({ where: { transactionId: tx.id }, select: { id: true } })
        if (existingRec) {
          const hasExt = await prisma.receiptExtraction.findUnique({ where: { receiptId: existingRec.id }, select: { id: true } })
          if (hasExt) continue
        }
        const recId = existingRec?.id ?? (
          await prisma.receipt.create({
            data: {
              transactionId: tx.id,
              userId,
              familyId,
              fileUrl: await getDemoReceiptFileUrl(familyId, tx.id, `agua-${tx.date.toISOString().slice(0, 7)}`),
            },
            select: { id: true },
          })
        ).id
        if (!existingRec || !(await prisma.receiptExtraction.findUnique({ where: { receiptId: recId }, select: { id: true } }))) {
          const d = new Date(tx.date)
          const start = new Date(d.getFullYear(), d.getMonth(), 1)
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          await prisma.receiptExtraction.create({
            data: {
              receiptId: recId,
              familyId,
              userId,
              merchantName: 'Agua',
              receiptDate: tx.date,
              total: '120',
              currency: 'MXN',
              receiptType: 'utility',
              consumptionQuantity: String(10 + (d.getMonth() % 3) * 2 + Math.floor(d.getMonth() / 6) * 1.5),
              consumptionUnit: 'm3',
              consumptionPeriodStart: start,
              consumptionPeriodEnd: end,
            },
          })
        }
      }

      // Productos (alimentos, etc.) para Reportes > Consumo: recibos "Super semana 1 {mes}" con extracción retail + ítems con cantidad/unidad
      const superTx = await prisma.transaction.findMany({
        where: { familyId, description: { startsWith: 'Super semana 1 ' } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      })
      for (const tx of superTx) {
        const existingRec = await prisma.receipt.findFirst({ where: { transactionId: tx.id }, select: { id: true } })
        if (existingRec) {
          const hasExt = await prisma.receiptExtraction.findUnique({ where: { receiptId: existingRec.id }, select: { id: true } })
          if (hasExt) continue
        }
        const recId = existingRec?.id ?? (
          await prisma.receipt.create({
            data: {
              transactionId: tx.id,
              userId,
              familyId,
              fileUrl: await getDemoReceiptFileUrl(familyId, tx.id, `super-${tx.date.toISOString().slice(0, 7)}`),
            },
            select: { id: true },
          })
        ).id
        if (!existingRec || !(await prisma.receiptExtraction.findUnique({ where: { receiptId: recId }, select: { id: true } }))) {
          // Variar cantidades por mes para que el reporte muestre suma (ej. ene 2L leche, feb 3L → total 5L)
          const monthFactor = 1 + (new Date(tx.date).getMonth() % 3) * 0.2
          const items = SEED_CONSUMPTION_ITEMS.map((it, idx) => ({
            quantity: Math.max(1, Math.round(it.quantity * monthFactor)),
            quantityUnit: it.quantityUnit,
            description: it.description,
          }))
          await prisma.receiptExtraction.create({
            data: {
              receiptId: recId,
              familyId,
              userId,
              merchantName: 'Super Demo',
              receiptDate: tx.date,
              total: '1280',
              currency: 'MXN',
              rawText: items.map((i) => `${i.description} ${i.quantity} ${i.quantityUnit}`).join('\n'),
              receiptType: 'retail',
              items: {
                create: items.map((it, idx) => ({
                  lineNumber: idx + 1,
                  description: it.description,
                  rawLine: `${it.description} ${it.quantity} ${it.quantityUnit}`,
                  quantity: it.quantity,
                  unitPrice: null,
                  amount: null,
                  isAdjustment: false,
                  isPlaceholder: false,
                  quantityUnit: it.quantityUnit,
                })),
              },
            },
          })
        }
      }
    } catch (err: any) {
      if (!receipt.reason) receipt = { created: false, skipped: true, reason: err?.message || 'No se pudo crear el recibo demo' }
    }

    return NextResponse.json({ ok: true, ...result, receipt }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'No se pudieron cargar datos ficticios'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}


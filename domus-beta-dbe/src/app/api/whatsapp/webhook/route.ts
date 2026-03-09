import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { findUserByPhone, normalizePhone, createTwiMLResponse, createTwiMLResponseMultiple, sendWhatsAppMessage, sendWhatsAppMessageAndGetSid, sendWhatsAppWithMediaAndGetSid, getDomusLinkSuffix } from '@/lib/whatsapp'
import { generateRegistrationCode, generateMoneyRequestRegistrationCode, type PrismaLike } from '@/lib/registration-code'
import { extractReceiptFromImageBytes } from '@/lib/receipts/extract'
import { uploadToSpaces, getSignedDownloadUrl } from '@/lib/storage/spaces'
import {
  getAgentReply,
  suggestCategoryForReceipt,
  parseMoneyRequestFromText,
  normalizeExpenseMessage,
  resolveCategoryFromConcept,
  parseReassignHints,
  extractRecipientFromReason,
} from '@/lib/agent/domus-agent'
import { generateTicketImagePng, generateCashReceiptTicketPng, generateRejectedTicketImagePng, type TicketData, type CashReceiptTicketData } from '@/lib/receipts/ticket-image'
import { findPossibleDuplicate } from '@/lib/dedup'
import { containsSensitiveData } from '@/lib/sensitive'
import { buildConsumptionSummary } from '@/lib/consumption/summary'

export const dynamic = 'force-dynamic'

/** Parsea mensaje tipo "500 cine Sofía" o "500 a Sofía cine" → { amount, concept, recipientName } */
function parseTextMessage(body: string): { amount: number; concept: string; recipientName: string | null } | null {
  const text = String(body || '').trim()
  if (!text) return null
  const numMatch = text.match(/^\s*(\d+(?:\.\d{1,2})?)\s+([\s\S]+)$/)
  if (!numMatch) return null
  const amount = parseFloat(numMatch[1]!)
  if (!Number.isFinite(amount) || amount <= 0) return null
  let rest = numMatch[2]!.trim()
  let concept = rest
  let recipientName: string | null = null
  const aPara = rest.match(/\b(?:a|para)\s+([^\d]+?)(?:\s+[-–—]\s*|\s*$)/i) || rest.match(/\b(?:a|para)\s+(\S+(?:\s+\S+)*)$/i)
  if (aPara) {
    recipientName = aPara[1]!.trim()
    concept = rest.replace(/\b(?:a|para)\s+[^\d]+?(?:\s+[-–—]\s*|\s*$)/i, '').trim() || recipientName
  } else {
    const parts = rest.split(/\s+/)
    if (parts.length >= 2 && !/^\d+\.?\d*$/.test(parts[parts.length - 1]!)) {
      recipientName = parts.pop()!.trim()
      concept = parts.join(' ').trim() || recipientName
    }
  }
  return { amount, concept, recipientName }
}

/** Detecta intención de solicitud de efectivo: "solicitud 500 cine", "necesito 500 cine", "quiero 500 para cine". */
function parseMoneyRequestIntent(body: string): { amount: number; reason: string } | null {
  const text = String(body || '').trim()
  if (!text) return null
  const lower = text.toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
  // solicitud [de] 500 [pesos] cine
  let match = text.match(/\bsolicitud\s+(?:de\s+)?(\d+(?:\.\d{1,2})?)\s+(?:pesos?\s+)?(.+)$/i)
  if (match) {
    const amount = parseFloat(match[1]!)
    const reason = match[2]!.trim()
    if (Number.isFinite(amount) && amount > 0 && reason.length >= 1) return { amount, reason }
  }
  // necesito 500 [pesos] [para] cine
  match = text.match(/\bnecesito\s+(\d+(?:\.\d{1,2})?)\s+(?:pesos?\s+)?(?:para\s+)?(.+)$/i)
  if (match) {
    const amount = parseFloat(match[1]!)
    const reason = match[2]!.trim()
    if (Number.isFinite(amount) && amount > 0 && reason.length >= 1) return { amount, reason }
  }
  // quiero 500 [pesos] [para] cine
  match = text.match(/\bquiero\s+(\d+(?:\.\d{1,2})?)\s+(?:pesos?\s+)?(?:para\s+)?(.+)$/i)
  if (match) {
    const amount = parseFloat(match[1]!)
    const reason = match[2]!.trim()
    if (Number.isFinite(amount) && amount > 0 && reason.length >= 1) return { amount, reason }
  }
  return null
}

const CONCEPT_TO_CATEGORY: Record<string, string> = {
  cine: 'Entretenimiento',
  pelicula: 'Entretenimiento',
  película: 'Entretenimiento',
  entretenimiento: 'Entretenimiento',
  super: 'Supermercado',
  supermercado: 'Supermercado',
  walmart: 'Supermercado',
  heb: 'Supermercado',
  soriana: 'Supermercado',
  chedraui: 'Supermercado',
  aurrera: 'Supermercado',
  bodega: 'Supermercado',
  sams: 'Supermercado',
  costco: 'Supermercado',
  'la comer': 'Supermercado',
  alimento: 'Supermercado',
  alimentos: 'Supermercado',
  comida: 'Supermercado',
  despensa: 'Supermercado',
  pastel: 'Comida',
  pasteles: 'Comida',
  cake: 'Comida',
  cakes: 'Comida',
  restaurante: 'Restaurantes',
  restaurantes: 'Restaurantes',
  reposteria: 'Comida',
  repostería: 'Comida',
  kuchen: 'Comida',
  kuchon: 'Comida',
  ruchron: 'Comida',
  pasteleria: 'Comida',
  pastelería: 'Comida',
  panaderia: 'Comida',
  panadería: 'Comida',
  dulces: 'Comida',
  cafe: 'Restaurantes',
  café: 'Restaurantes',
  pan: 'Comida',
  farmacia: 'Salud',
  medicina: 'Salud',
  medicinas: 'Salud',
  salud: 'Salud',
  medicamentos: 'Salud',
  veterinario: 'Veterinario',
  vet: 'Veterinario',
  mascotas: 'Mascotas',
  colegiatura: 'Colegiaturas',
  colegiaturas: 'Colegiaturas',
  útiles: 'Útiles escolares',
  utiles: 'Útiles escolares',
  renta: 'Renta / Hipoteca',
  hipoteca: 'Renta / Hipoteca',
  servicios: 'Servicios (luz/agua/internet)',
  luz: 'Servicios (luz/agua/internet)',
  agua: 'Servicios (luz/agua/internet)',
  cfe: 'Servicios (luz/agua/internet)',
  electricidad: 'Servicios (luz/agua/internet)',
  energía: 'Servicios (luz/agua/internet)',
  energia: 'Servicios (luz/agua/internet)',
  gas: 'Servicios (luz/agua/internet)',
  internet: 'Internet / Teléfono',
  teléfono: 'Internet / Teléfono',
  cumpleaños: 'Eventos familiares',
  cumple: 'Eventos familiares',
  eventos: 'Eventos familiares',
  evento: 'Eventos familiares',
  fiesta: 'Eventos familiares',
  fiestas: 'Eventos familiares',
  festejo: 'Eventos familiares',
}

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
}

function asDecimalString(value: unknown, digits = 2): string | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(String(value))
  if (!Number.isFinite(n)) return null
  const p = 10 ** digits
  const rounded = Math.round(n * p) / p
  return String(rounded)
}

function parseDateOnly(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

type AllocationWithDetails = {
  allocationId: string
  categoryId: string
  entityName: string
  categoryName: string
  /** true si se asignó por nombre de usuario/entidad en el mensaje */
  assignedByName: boolean
}

/** Busca una asignación activa por familia; opcionalmente por nombre de entidad y categoría. Devuelve id + datos para clasificación y mensaje. */
async function findAllocationWithDetails(
  familyId: string,
  options: { entityNameHint?: string | null; categoryHint?: string | null },
): Promise<AllocationWithDetails | null> {
  const allocs = await prisma.entityBudgetAllocation.findMany({
    where: {
      familyId,
      isActive: true,
      entity: { isActive: true, participatesInBudget: true },
      category: { isActive: true },
    },
    select: {
      id: true,
      categoryId: true,
      entity: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!allocs.length) return null
  const entityHint = options.entityNameHint ? norm(options.entityNameHint) : null
  const catHint = options.categoryHint ? norm(options.categoryHint) : null
  let chosen = allocs[0]!
  let assignedByName = false
  if (entityHint || catHint) {
    const scored = allocs.map((a) => {
      const en = norm(a.entity.name)
      const cn = norm(a.category.name)
      let score = 0
      if (entityHint && en.includes(entityHint)) score += 10
      if (entityHint && entityHint.includes(en)) score += 5
      if (catHint && cn.includes(catHint)) score += 10
      if (catHint && catHint.includes(cn)) score += 5
      // Sinónimos para "Comida": Alimentos, Supermercado, Restaurantes (para que pastel/repostería acierte)
      if (catHint && norm(catHint) === 'comida') {
        if (cn.includes('alimento') || cn.includes('supermercado') || cn.includes('restaurante') || cn.includes('comida')) score += 10
      }
      // Sinónimos para "Eventos familiares": Cumpleaños, Fiestas, Eventos o Comida (pastel/cumple → Comida si no hay Eventos)
      if (catHint && norm(catHint).includes('eventos familiares')) {
        if (cn.includes('cumple') || cn.includes('fiesta') || cn.includes('evento') || cn.includes('comida')) score += 10
      }
      return { alloc: a, score }
    })
    const best = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)[0]
    if (best) {
      chosen = best.alloc
      assignedByName = !!entityHint && best.score >= 5
    } else if (catHint && (norm(catHint) === 'comida' || norm(catHint).includes('eventos familiares'))) {
      // Concepto es comida/pastel/cumple pero ninguna partida coincidió: evitar Renta/Hipoteca
      const notRenta = allocs.find((a) => {
        const cn = norm(a.category.name)
        return !cn.includes('renta') && !cn.includes('hipoteca')
      })
      if (notRenta) chosen = notRenta
    }
  }
  return {
    allocationId: chosen.id,
    categoryId: chosen.categoryId,
    entityName: chosen.entity.name,
    categoryName: chosen.category.name,
    assignedByName,
  }
}

/** Compatibilidad: devuelve solo el id. */
async function findAllocationForFamily(
  familyId: string,
  options: { entityNameHint?: string | null; categoryHint?: string | null },
): Promise<string | null> {
  const d = await findAllocationWithDetails(familyId, options)
  return d?.allocationId ?? null
}

/** Preferencia aprendida: comercio/concepto → categoría por familia. */
async function getFamilyCategoryPreference(
  familyId: string,
  preferenceKey: string,
): Promise<{ categoryId: string; categoryName: string } | null> {
  if (!preferenceKey || preferenceKey.length < 2) return null
  const pref = await prisma.familyCategoryPreference.findUnique({
    where: { familyId_preferenceKey: { familyId, preferenceKey } },
    select: { category: { select: { id: true, name: true } } },
  })
  if (!pref?.category) return null
  return { categoryId: pref.category.id, categoryName: pref.category.name }
}

/** Guarda o actualiza preferencia (aprendizaje por uso). Devuelve true si era nueva (creada), false si se actualizó. */
async function saveFamilyCategoryPreference(
  familyId: string,
  preferenceKey: string,
  categoryId: string,
): Promise<boolean> {
  if (!preferenceKey || preferenceKey.length < 2 || !categoryId) return false
  const existing = await prisma.familyCategoryPreference.findUnique({
    where: { familyId_preferenceKey: { familyId, preferenceKey } },
    select: { id: true },
  })
  await prisma.familyCategoryPreference.upsert({
    where: { familyId_preferenceKey: { familyId, preferenceKey } },
    create: { familyId, preferenceKey, categoryId },
    update: { categoryId },
  })
  return !existing
}

/** Notifica al admin por WhatsApp que DOMUS aprendió una preferencia nueva (para que sepas que está aprendiendo). */
async function notifyAdminPreferenceLearned(
  familyId: string,
  preferenceKey: string,
  categoryName: string,
): Promise<void> {
  const admin = await prisma.familyMember.findFirst({
    where: { familyId, isFamilyAdmin: true },
    select: { user: { select: { phone: true } } },
  })
  if (!admin?.user?.phone) return
  const msg = `📚 DOMUS aprendió: "${preferenceKey}" → ${categoryName}. Los próximos recibos de ese comercio irán ahí.${getDomusLinkSuffix()}`
  await sendWhatsAppMessageAndGetSid(admin.user.phone, msg).catch(() => {})
}

/** Resuelve categoría a partir del concepto (ej. "cine" → Entretenimiento). */
function resolveCategoryHint(concept: string): string | null {
  const c = norm(concept)
  for (const [key, cat] of Object.entries(CONCEPT_TO_CATEGORY)) {
    if (c.includes(key) || key.includes(c)) return cat
  }
  return null
}

/** Extrae nombre para asignación del pie de foto (ej. "para Juan", "a María", "Sofía"). */
function parseAssignmentNameFromCaption(body: string | null): string | null {
  const text = String(body ?? '').trim()
  if (!text) return null
  const paraMatch = text.match(/\b(?:para|a)\s+([^\d,.\n]+?)(?:\s*[.\n]|$)/i)
  if (paraMatch) return paraMatch[1]!.trim()
  const words = text.split(/\s+/).filter((w) => w.length > 1 && !/^\d+\.?\d*$/.test(w))
  if (words.length >= 1) return words[words.length - 1]!.trim()
  return null
}

/** Extrae nombre para asignación del texto OCR del recibo (ej. "para Sofia", "a Juan" escrito en la foto). */
function parseAssignmentNameFromExtraction(extraction: { rawText?: string | null }): string | null {
  const raw = extraction?.rawText ?? ''
  if (!raw.trim()) return null
  const paraMatch = raw.match(/\b(?:para|a)\s+([a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]+?)(?:\s*[.\n,]|$)/i)
  if (paraMatch) {
    const name = paraMatch[1]!.trim()
    if (name.length >= 2 && name.length <= 50) return name
  }
  return null
}

/** Detecta mensaje tipo "E-HZSC cumpleaños sofia" o "E-HZSC. para Juan" para reasignar por clave. */
function parseCodeAndAssignment(body: string | null): { code: string; rest: string } | null {
  const text = String(body ?? '').trim()
  const match = text.match(/^(E|I)-([A-Z0-9]+)\s*[.:]?\s*(.*)$/i)
  if (!match) return null
  const code = `${match[1]!}-${match[2]!}`.toUpperCase()
  const rest = match[3]!.trim()
  return { code, rest }
}

/** De un texto de asignación (ej. "cumpleaños sofia") obtiene hint de categoría y de entidad. */
function parseConceptAndEntityForReassign(text: string): { categoryHint: string | null; entityHint: string | null } {
  const t = text.trim()
  if (!t) return { categoryHint: null, entityHint: null }
  const entityFromPara = parseAssignmentNameFromCaption(t)
  const categoryHint = resolveCategoryHint(t)
  const entityHint = entityFromPara ?? (() => {
    const words = t.split(/\s+/).filter((w) => w.length > 1 && !/^\d+\.?\d*$/.test(w))
    const last = words[words.length - 1]
    if (!last) return null
    const lastNorm = norm(last)
    const isCategory = Object.keys(CONCEPT_TO_CATEGORY).some((k) => lastNorm.includes(k) || norm(k).includes(lastNorm))
    return isCategory ? null : last
  })()
  return { categoryHint, entityHint }
}

const DOMUS_WHATSAPP_HELP = `*¿Qué puedes hacer con DOMUS por WhatsApp?*

• *Registrar un gasto:* escribe _monto concepto_ (ej. 500 cine Sofía), o envía una *foto del recibo* o *PDF* (ej. factura CFE).
• *Solicitar efectivo (aquí o en la app):* por aquí escribe _solicitud 500 cine_, _necesito 300 super_ o _quiero 200 farmacia_. Se crea la solicitud y se avisa al admin. También puedes usar la app (Solicitudes → Solicitud de efectivo); te confirmamos por aquí.
• *Reasignar un gasto:* escribe la clave y asignación (ej. E-ABC12 cumpleaños Sofía), o *responde al mensaje* de confirmación con "para Sofía" o "cumpleaños Juan".
• *Registrar entrega de efectivo:* si eres admin, *responde con la foto del comprobante* al mensaje de la solicitud. Se registra y se aprueba automáticamente; el solicitante recibe un recibo de recepción por WhatsApp.
• *Categorías nuevas:* si un recibo no encaja, DOMUS puede sugerir una. El admin responde *sí* o *adhierela* a ese mensaje.
• *Preguntar a DOMUS:* escribe en lenguaje natural (ej. "¿cuánto gastamos?" o "¿hay solicitudes pendientes?") y DOMUS te responde.
• *Precios y consumos:* escribe _precios_ o _resumen consumos_ para recibir un resumen de subidas de precio, mejor precio por producto y consumo de luz/agua.

Escribe *ayuda* o *intro* para ver la guía completa.`

/** Onboarding en 2 mensajes: parte 1 (qué es DOMUS, registrar gasto, recibo rojo). */
const DOMUS_WHATSAPP_ONBOARDING_PART1 = `*DOMUS — Guía por WhatsApp (1/2)*

Hola. Con DOMUS puedes registrar gastos, solicitar efectivo y llevar el presupuesto familiar desde aquí.

━━━━━━━━━━━━━━━━━━━━
*1. Registrar un gasto*
━━━━━━━━━━━━━━━━━━━━
• Escribe *monto y concepto* (ej. _500 cine Sofía_).
• O envía una *foto del recibo* o *PDF* (factura, ticket). DOMUS extrae el total y la fecha y registra el gasto.
• Recibirás un *recibo de confirmación* (verde) con concepto, monto, clave y clasificación. Para asignarlo a alguien, responde a ese mensaje con "para [nombre]" o "cumpleaños Sofía".

━━━━━━━━━━━━━━━━━━━━
*2. Recibo rojo — Rechazo / duplicado*
━━━━━━━━━━━━━━━━━━━━
Si envías un comprobante *duplicado* (mismo monto y fecha que uno ya registrado), recibirás un *recibo en rojo* "RECHAZADO — Duplicado". *Ese gasto no se registra*.
• Responde *descartar*, *cancelar* o *no* para confirmar, o envía la foto del *comprobante correcto* si fue error.`

/** Onboarding parte 2 (solicitud efectivo, recibo recepción, instrucciones, ayuda). */
const DOMUS_WHATSAPP_ONBOARDING_PART2 = `*DOMUS — Guía por WhatsApp (2/2)*

━━━━━━━━━━━━━━━━━━━━
*3. Solicitud de efectivo*
━━━━━━━━━━━━━━━━━━━━
Escribe: _solicitud 500 cine_, _necesito 300 super_, _quiero 200 farmacia_. Se avisa al admin. Cuando te entreguen el dinero, el admin responde con la *foto del comprobante* y se registra. Tú recibes un *recibo de recepción de efectivo* (azul/verde) con el monto y la clave.

━━━━━━━━━━━━━━━━━━━━
*4. Instrucciones que puedes dar*
━━━━━━━━━━━━━━━━━━━━
• _500 cine Sofía_ → gasto por texto
• _solicitud 300 farmacia_ → pedir efectivo
• _E-ABC12 cumpleaños Sofía_ → reasignar por clave
• Responde *para [nombre]* al recibo verde → asignar
• _precios_ o _resumen consumos_ → resumen
• "¿cuánto gastamos?" → pregunta en lenguaje natural

━━━━━━━━━━━━━━━━━━━━
*5. Ayuda*
━━━━━━━━━━━━━━━━━━━━
Escribe *ayuda*, *intro* o *qué haces* para ver esta guía de nuevo.

${getDomusLinkSuffix()}`

/** Detecta si el usuario pide la guía de onboarding / ayuda / introducción. */
function isOnboardingTrigger(text: string): boolean {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '').replace(/\s+/g, ' ')
  if (!t || t.length > 120) return false
  if (['onboard', 'onboarding', 'intro', 'introduccion', 'introducción', 'bienvenida', 'ayuda', 'help', 'domus', 'menu', 'menú'].includes(t)) return true
  if (/^que\s+haces\s*\.*$/.test(t)) return true
  if (/^qué\s+haces\s*\.*$/.test(t)) return true
  if (/^como\s+me\s+puedes\s+ayudar\s*\.*$/i.test(t)) return true
  if (/^cómo\s+me\s+puedes\s+ayudar\s*\.*$/i.test(t)) return true
  if (/^que\s+puedo\s+(hacer|hacer con)/.test(t)) return true
  if (/^qué\s+puedo\s+(hacer|hacer con)/.test(t)) return true
  if (/^para\s+que\s+sirves\s*\.*$/i.test(t)) return true
  if (/^que\s+es\s+domus\s*\.*$/i.test(t)) return true
  if (/^qué\s+es\s+domus\s*\.*$/i.test(t)) return true
  return false
}

function isHelpTrigger(text: string): boolean {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
  if (!t) return false
  if (t === 'ayuda' || t === 'help' || t === 'domus' || t === 'menu' || t === 'menú') return true
  if (/^que\s+puedo\s+(hacer|hacer con)/.test(t)) return true
  if (/^qué\s+puedo\s+(hacer|hacer con)/.test(t)) return true
  return false
}

/** Detecta si el usuario confirma que descarta el comprobante (duplicado/rechazado). Acepta varias formas. */
function isDiscardReceiptIntent(text: string): boolean {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '').replace(/\s+/g, ' ')
  if (!t || t.length > 80) return false
  const discardPhrases = [
    'descartar',
    'descarta',
    'descartalo',
    'deshechar',
    'deshecha',
    'cancelar',
    'cancela',
    'rechazar',
    'rechaza',
    'rechazo',
    'no registrar',
    'no lo registres',
    'no registres',
    'omitir',
    'omite',
    'no',
    'descarto',
    'descartado',
  ]
  if (discardPhrases.includes(t)) return true
  if (/^(no|nope|nel)\s*\.*$/.test(t)) return true
  if (/^descartar\s+(el\s+)?(comprobante|recibo|gasto)?\.*$/i.test(t)) return true
  if (/^descarta(rlo)?\.*$/i.test(t)) return true
  if (/^cancelar\s+(el\s+)?(comprobante|recibo)?\.*$/i.test(t)) return true
  if (/^rechaza(rlo)?\.*$/i.test(t)) return true
  return false
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook is active', project: 'domus-beta-dbe' })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''
    const mediaUrl0 = formData.get('MediaUrl0')?.toString()
    const mediaContentType0 = formData.get('MediaContentType0')?.toString()

    const phone = normalizePhone(from)
    const user = await findUserByPhone(phone)
    if (!user) {
      return createTwiMLResponse(
        `No estás registrado en DOMUS con el número ${phone}. Regístrate en la app y añade este teléfono en tu perfil.`,
      )
    }

    const membership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      select: { familyId: true, isFamilyAdmin: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) {
      return createTwiMLResponse('No perteneces a ninguna familia en DOMUS. Crea o únete a una familia en la app.')
    }
    const familyId = membership.familyId

    if (isHelpTrigger(body) || isOnboardingTrigger(body)) {
      return createTwiMLResponseMultiple([DOMUS_WHATSAPP_ONBOARDING_PART1, DOMUS_WHATSAPP_ONBOARDING_PART2])
    }

    if (body.trim() && isDiscardReceiptIntent(body)) {
      return createTwiMLResponse(
        'Comprobante descartado. No se registró el gasto. Si tienes el comprobante correcto, envía la foto y lo procesamos.',
      )
    }

    const bodyNorm = body.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
    if (/^(precios|resumen\s+consumos|resumen\s+precios|consumos)$/.test(bodyNorm)) {
      try {
        const summary = await buildConsumptionSummary(familyId, {})
        return createTwiMLResponse(summary || 'Aún no hay suficientes datos de recibos o utilidades para el resumen.')
      } catch (e) {
        console.warn('buildConsumptionSummary:', e)
        return createTwiMLResponse('No pude generar el resumen. Intenta más tarde o revisa en la app.')
      }
    }

    let moneyRequestPayload: { amount: number; reason: string; forName?: string | null } | null = parseMoneyRequestIntent(body)
    if (!moneyRequestPayload && body.trim().length > 0 && body.length <= 250) {
      moneyRequestPayload = await parseMoneyRequestFromText(body) ?? null
    }
    if (moneyRequestPayload) {
      let { amount, reason, forName } = moneyRequestPayload
      if (containsSensitiveData(reason)) {
        return createTwiMLResponse('No guardamos datos sensibles (tarjetas, contraseñas). Escribe solo el motivo del gasto, sin datos personales.')
      }
      const forNameFromReason = extractRecipientFromReason(reason)
      const recipientName = forName ?? forNameFromReason ?? null
      const categoryNames = await prisma.budgetCategory.findMany({
        where: { familyId, isActive: true },
        select: { name: true },
      }).then((c) => c.map((x) => x.name))
      let categoryHint = resolveCategoryHint(reason) || reason
      if (!categoryNames.some((n) => norm(n) === norm(categoryHint))) {
        const resolved = await resolveCategoryFromConcept(reason, categoryNames)
        if (resolved?.type === 'from_list') categoryHint = resolved.name
        else if (resolved?.type === 'suggest_new') categoryHint = resolved.name
      }
      const allocation = await findAllocationWithDetails(familyId, {
        entityNameHint: null,
        categoryHint,
      })
      if (!allocation) {
        return createTwiMLResponse('No hay partidas configuradas para esta solicitud. Configura Presupuesto en la app o indica otro motivo.')
      }
      const registrationCode = await generateMoneyRequestRegistrationCode(prisma, familyId)
      const created = await prisma.moneyRequest.create({
        data: {
          familyId,
          createdByUserId: user.id,
          allocationId: allocation.allocationId,
          forName: recipientName ?? undefined,
          date: new Date(),
          reason,
          amount,
          currency: 'MXN',
          status: 'PENDING',
          registrationCode,
        },
        select: { id: true, registrationCode: true, amount: true, reason: true },
      })
      const adminMember = await prisma.familyMember.findFirst({
        where: { familyId, isFamilyAdmin: true },
        select: { user: { select: { phone: true } } },
      })
      const adminPhone = adminMember?.user?.phone
      if (adminPhone) {
        const creatorName = user.name || user.email || 'Alguien'
        const amountStr = Number(created.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        const adminMsg = `Nueva solicitud de efectivo: *${created.registrationCode ?? '—'}*\nMotivo: ${created.reason}\nMonto: $${amountStr} MXN\nSolicitante: ${creatorName}\n\n_Responde a ESTE mensaje con la foto del comprobante para registrar la entrega (no hace falta aceptar en la app; el solicitante recibirá un recibo por WhatsApp)._${getDomusLinkSuffix()}`
        const sent = await sendWhatsAppMessageAndGetSid(adminPhone, adminMsg)
        if (sent.ok && sent.sid) {
          await prisma.moneyRequest.update({
            where: { id: created.id },
            data: { outboundMessageSid: sent.sid },
          })
        }
      }
      const amountStr = Number(created.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      return createTwiMLResponse(
        `Solicitud de efectivo creada: *${created.registrationCode ?? '—'}*\nMonto: $${amountStr} MXN\nMotivo: ${created.reason}\n\nRevisa en la app o espera la respuesta del admin.${getDomusLinkSuffix()}`,
      )
    }

    const referredMessageSid =
      formData.get('OriginalRepliedMessageSid')?.toString() ||
      formData.get('ReferredMessageSid')?.toString() ||
      ''
    if (mediaUrl0 && mediaContentType0?.startsWith('image/') && referredMessageSid) {
      const deliverResult = await handleMoneyRequestReplyDeliver({
        mediaUrl0,
        user,
        familyId,
        isFamilyAdmin: membership.isFamilyAdmin ?? false,
        referredMessageSid,
      })
      if (deliverResult) return deliverResult
    }

    if (mediaUrl0 && mediaContentType0?.startsWith('image/')) {
      return await handleImageMessage({
        mediaUrl0,
        body,
        user,
        familyId,
        messageSid,
        fromPhone: from,
      })
    }

    if (mediaUrl0 && (mediaContentType0 === 'application/pdf' || (mediaContentType0 || '').toLowerCase().includes('pdf'))) {
      return await handlePdfMessage({
        mediaUrl0,
        body,
        user,
        familyId,
        fromPhone: from,
      })
    }

    if (referredMessageSid && body?.trim()) {
      const categorySuggestionReply = await handleReplyToCategorySuggestion({
        referredMessageSid,
        body: body.trim(),
        familyId,
        isFamilyAdmin: membership.isFamilyAdmin ?? false,
      })
      if (categorySuggestionReply) return categorySuggestionReply
      const replyResult = await handleReplyToReceiptConfirmation({
        referredMessageSid,
        body: body.trim(),
        familyId,
      })
      if (replyResult) return replyResult
    }

    const codeAndAssignment = parseCodeAndAssignment(body)
    if (codeAndAssignment) {
      const { code, rest } = codeAndAssignment
      const txByCode = await prisma.transaction.findFirst({
        where: { familyId, registrationCode: code },
        select: {
          id: true,
          description: true,
          amount: true,
          allocationId: true,
          allocation: { select: { entity: { select: { name: true } }, category: { select: { name: true } } } },
        },
      })
      if (!txByCode) {
        return createTwiMLResponse(`No hay ninguna transacción con la clave ${code} en tu familia. Revisa la clave.`)
      }
      if (!rest) {
        return createTwiMLResponse(
          `Indica la asignación para ${code}, por ejemplo:\n${code} cumpleaños Sofía\n${code} para Juan super`,
        )
      }
      const [entityNamesReassign, categoryNamesReassign] = await Promise.all([
        prisma.budgetEntity.findMany({
          where: { familyId, isActive: true },
          select: { name: true },
        }).then((e) => e.map((x) => x.name)),
        prisma.budgetCategory.findMany({
          where: { familyId, isActive: true },
          select: { name: true },
        }).then((c) => c.map((x) => x.name)),
      ])
      const hintsFromIa = await parseReassignHints(rest, { entityNames: entityNamesReassign, categoryNames: categoryNamesReassign })
      const categoryHint = hintsFromIa.categoryHint || parseConceptAndEntityForReassign(rest).categoryHint
      const entityHint = hintsFromIa.entityHint || parseConceptAndEntityForReassign(rest).entityHint
      const allocation = await findAllocationWithDetails(familyId, {
        entityNameHint: entityHint,
        categoryHint: categoryHint || rest,
      })
      if (!allocation) {
        return createTwiMLResponse('No hay asignaciones que coincidan. Configura Presupuesto en la app o usa otros términos.')
      }
      const prevEntity = (txByCode as any).allocation?.entity?.name ?? '—'
      const prevCategory = (txByCode as any).allocation?.category?.name ?? '—'
      await prisma.transaction.update({
        where: { id: txByCode.id },
        data: { allocationId: allocation.allocationId, pendingReason: null },
      })
      const now = new Date()
      const ts = now.toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      const msg = `${ts} — Transacción ${code} actualizada. Cambio de ${prevEntity} / ${prevCategory} a ${allocation.entityName} / ${allocation.categoryName}. (Reenvía este mensaje para informar.)`
      return createTwiMLResponse(msg)
    }

    let parsed = parseTextMessage(body)
    if (!parsed && body.trim().length > 0 && body.length <= 200) {
      const normalized = await normalizeExpenseMessage(body)
      if (normalized) parsed = normalized
    }
    if (!parsed) {
      if (body.trim()) {
        const agentReply = await getAgentReply(body, familyId, user.id, user.name)
        if (agentReply) return createTwiMLResponse(agentReply)
      }
      return createTwiMLResponse(
        'Envía un mensaje con monto y concepto, por ejemplo:\n500 cine Sofía\n300 a Mamá super\nO envía una foto del recibo.\nPara reasignar por clave: E-HZSC cumpleaños Sofía\n\nEscribe *ayuda* para ver qué puedes hacer con DOMUS.',
      )
    }

    if (containsSensitiveData(parsed.concept) || (parsed.recipientName && containsSensitiveData(parsed.recipientName))) {
      return createTwiMLResponse('No guardamos datos sensibles. Escribe solo monto y concepto (ej: 500 cine).')
    }
    const categoryNamesForTx = await prisma.budgetCategory.findMany({
      where: { familyId, isActive: true },
      select: { name: true },
    }).then((c) => c.map((x) => x.name))
    let categoryHint = resolveCategoryHint(parsed.concept)
    if (!categoryHint && categoryNamesForTx.length) {
      const resolved = await resolveCategoryFromConcept(parsed.concept, categoryNamesForTx)
      if (resolved?.type === 'from_list') categoryHint = resolved.name
      else if (resolved?.type === 'suggest_new') categoryHint = resolved.name
    }
    const allocation = await findAllocationWithDetails(familyId, {
      entityNameHint: parsed.recipientName,
      categoryHint: categoryHint || parsed.concept,
    })
    if (!allocation) {
      return createTwiMLResponse('No hay asignaciones configuradas en tu familia. Configura Presupuesto en la app.')
    }
    const pendingReasonText = allocation.assignedByName ? null : 'categoría y usuario'
    const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
    const created = await prisma.transaction.create({
      data: {
        familyId,
        userId: user.id,
        allocationId: allocation.allocationId,
        amount: String(parsed.amount),
        date: new Date(),
        description: parsed.concept + (parsed.recipientName ? ` (para ${parsed.recipientName})` : ''),
        registrationCode,
        pendingReason: pendingReasonText,
      },
      select: { id: true, registrationCode: true },
    })

    const senderName = user.name || user.email
    let confirmMsg = `Registrado $${parsed.amount} – ${parsed.concept}. Código: ${created.registrationCode ?? '—'}.`
    if (!parsed.recipientName) {
      confirmMsg += `\n\n¿Para quién es? Responde a este mensaje con "para [nombre]" para asignar (ej. para Sofía).`
    }

    if (parsed.recipientName) {
      const recipientNameNorm = parsed.recipientName.trim().toLowerCase()
      const familyMembers = await prisma.familyMember.findMany({
        where: { familyId },
        select: { user: { select: { id: true, name: true, phone: true } } },
      })
      const recipientUser = familyMembers
        .map((m) => m.user)
        .find(
          (u) =>
            u.id !== user.id &&
            u.name &&
            (u.name.toLowerCase().includes(recipientNameNorm) || recipientNameNorm.includes(u.name.toLowerCase())),
        )
      if (recipientUser?.phone && recipientUser.id !== user.id) {
        const comprobante = `Comprobante DOMUS: ${senderName} registró $${parsed.amount} – ${parsed.concept}. Código: ${created.registrationCode ?? '—'}. Consulta en la app.${getDomusLinkSuffix()}`
        await sendWhatsAppMessage(recipientUser.phone, comprobante)
      }
    }

    return createTwiMLResponse(confirmMsg + getDomusLinkSuffix())
  } catch (e: any) {
    console.error('WhatsApp webhook error:', e)
    return createTwiMLResponse('Ocurrió un error. Intenta de nuevo o registra el gasto en la app.')
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

/** Si el usuario responde con imagen al mensaje de notificación de solicitud, registra la entrega (y auto-aprueba si estaba pendiente). Devuelve Response o null si no aplica. */
async function handleMoneyRequestReplyDeliver(args: {
  mediaUrl0: string
  user: { id: string; name: string | null; email: string }
  familyId: string
  isFamilyAdmin: boolean
  referredMessageSid: string
}): Promise<Response | null> {
  const { mediaUrl0, user, familyId, isFamilyAdmin, referredMessageSid } = args
  const mr = await prisma.moneyRequest.findFirst({
    where: { familyId, outboundMessageSid: referredMessageSid },
    select: {
      id: true,
      status: true,
      amount: true,
      allocationId: true,
      date: true,
      reason: true,
      registrationCode: true,
      createdByUserId: true,
      createdBy: { select: { phone: true, name: true } },
    },
  })
  if (!mr) return null

  if (!isFamilyAdmin) {
    return createTwiMLResponse('Solo el administrador puede registrar la entrega desde WhatsApp.')
  }
  if (mr.status !== 'PENDING' && mr.status !== 'APPROVED') {
    return createTwiMLResponse('Esta solicitud ya fue procesada o rechazada.')
  }
  if (!mr.allocationId) {
    return createTwiMLResponse('Esta solicitud no tiene partida asignada. Registra la entrega desde la app indicando la partida.')
  }

  let imageBytes: Buffer
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const headers: Record<string, string> = {}
    if (sid && token) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
    }
    const res = await fetch(mediaUrl0, { headers })
    if (!res.ok) throw new Error(`Download: ${res.status}`)
    imageBytes = Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error('WhatsApp deliver: download image:', e)
    return createTwiMLResponse('No se pudo descargar la imagen. Intenta de nuevo.')
  }
  if (imageBytes.length < 1) return createTwiMLResponse('La imagen está vacía.')

  let fileUrl: string
  try {
    const key = `families/${familyId}/transactions/${mr.id}-deliver-wa/${Date.now()}-1-${safeFileName('comprobante.jpg')}`
    fileUrl = await uploadToSpaces({
      key,
      body: imageBytes,
      contentType: 'image/jpeg',
    })
  } catch (e) {
    console.warn('WhatsApp deliver: upload Spaces:', e)
    return createTwiMLResponse('No se pudo guardar el comprobante (configura DO_SPACES_*). Registra la entrega desde la app.')
  }

  const finalAmount = Number(mr.amount)
  const txDescription = containsSensitiveData(mr.reason ?? '')
    ? 'Solicitud efectivo'
    : `Solicitud efectivo: ${mr.reason}`
  const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        familyId,
        userId: mr.createdByUserId,
        allocationId: mr.allocationId,
        amount: String(finalAmount),
        date: mr.date,
        description: txDescription,
        registrationCode,
      },
      select: { id: true, registrationCode: true },
    }),
  ])

  const receipt = await prisma.receipt.create({
    data: {
      transactionId: transaction.id,
      userId: user.id,
      familyId,
      fileUrl,
      images: { create: [{ fileUrl, sortOrder: 1 }] },
    },
    select: { id: true },
  })

  await prisma.receiptExtraction.create({
    data: {
      receiptId: receipt.id,
      familyId,
      userId: user.id,
      merchantName: `Solicitud efectivo: ${(mr.reason ?? '').slice(0, 180)}`,
      total: finalAmount,
      receiptDate: mr.date,
      currency: 'MXN',
    },
  })

  const now = new Date()
  await prisma.moneyRequest.update({
    where: { id: mr.id },
    data: {
      status: 'DELIVERED',
      transactionId: transaction.id,
      deliveredAt: now,
      ...(mr.status === 'PENDING' ? { approvedAt: now, approvedByUserId: user.id } : {}),
    },
  })

  const code = mr.registrationCode ?? '—'
  const amountStr = finalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const requesterPhone = mr.createdBy?.phone
  if (requesterPhone) {
    const ticketData: CashReceiptTicketData = {
      concept: containsSensitiveData(mr.reason ?? '') ? 'Solicitud efectivo' : (mr.reason ?? 'Solicitud efectivo').slice(0, 50),
      amount: finalAmount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      currency: 'MXN',
      date: mr.date.toLocaleDateString('es-MX'),
      time: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      code: code,
      deliveredBy: user.name ?? undefined,
    }
    const textFallback = `✅ *Recibo de recepción de efectivo*\nClave: ${code}\nMonto: $${amountStr} MXN\nMotivo: ${ticketData.concept}\nEntregado por: ${user.name || 'Admin'}${getDomusLinkSuffix()}`
    try {
      const ticketPng = await generateCashReceiptTicketPng(ticketData)
      const ticketKey = `families/${familyId}/cash-receipts/ticket-${mr.id}-${Date.now()}.png`
      await uploadToSpaces({
        key: ticketKey,
        body: ticketPng,
        contentType: 'image/png',
      })
      const ticketUrl = await getSignedDownloadUrl({ key: ticketKey, expiresInSeconds: 3600 })
      await sendWhatsAppWithMediaAndGetSid(requesterPhone, ticketUrl, {
        body: `Recibo de recepción de efectivo. Clave: ${code}. Has recibido $${amountStr} MXN.${getDomusLinkSuffix()}`,
      })
    } catch (e) {
      console.warn('WhatsApp cash receipt ticket image fallback to text:', e)
      await sendWhatsAppMessage(requesterPhone, textFallback)
    }
  }

  return createTwiMLResponse(`Entrega registrada para ${code}. Monto: $${amountStr}.${requesterPhone ? ' Se envió recibo de recepción al solicitante.' : ''}${getDomusLinkSuffix()}`)
}

type ProcessReceiptUser = { id: string; name: string | null; email: string }

/** Procesa imagen de recibo (o primera página de PDF convertida): extrae, asigna, crea transacción y recibo. */
async function processReceiptFromImageBytes(
  imageBytes: Buffer,
  contentType: string,
  body: string | null,
  user: ProcessReceiptUser,
  familyId: string,
): Promise<
  | { ok: true; message: string; transactionId: string; ticketData: TicketData }
  | { ok: false; error: string }
  | { ok: false; duplicate: true; ticketData: TicketData; duplicateWarning: { transactionId: string; date: string; description: string | null; amount: string }; message: string }
> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Por ahora solo se aceptan mensajes de texto (ej: 500 cine Sofía). La foto de recibo requiere configurar el servidor.' }
  }
  const model = process.env.OPENAI_RECEIPT_MODEL || 'gpt-4o-mini'
  let extraction: Awaited<ReturnType<typeof extractReceiptFromImageBytes>> | null = null
  try {
    extraction = await extractReceiptFromImageBytes({ apiKey, model, imageBytes, mode: 'fast' })
  } catch (e) {
    console.error('OCR:', e)
    return { ok: false, error: 'No se pudo leer el recibo. Envía una foto más nítida o escribe el monto y concepto por texto.' }
  }
  const total = typeof extraction?.total === 'number' ? extraction.total : null
  if (!total || total <= 0) {
    return { ok: false, error: 'No se detectó un total en la imagen. Escribe el monto por texto (ej: 500 cine Sofía).' }
  }
  const merchantName = extraction?.merchantName?.trim() || ''
  const rawSnippet = extraction?.rawText?.slice(0, 400) || ''
  const preferenceKey = merchantName ? norm(merchantName) : ''
  const learnedPreference = preferenceKey
    ? await getFamilyCategoryPreference(familyId, preferenceKey)
    : null
  const allocsForCategories = await prisma.entityBudgetAllocation.findMany({
    where: { familyId, isActive: true, entity: { isActive: true }, category: { isActive: true } },
    select: { category: { select: { name: true } } },
  })
  const categoryNames = [...new Set(allocsForCategories.map((a) => a.category.name).filter(Boolean))]
  let categoryHint: string | null = learnedPreference ? learnedPreference.categoryName : null
  if (!categoryHint) {
    const aiResult = await suggestCategoryForReceipt(merchantName, rawSnippet, categoryNames)
    if (aiResult?.type === 'from_list') categoryHint = aiResult.name
    else if (aiResult?.type === 'suggest_new') {
    const existing = await prisma.categorySuggestion.findFirst({
      where: { familyId, suggestedName: aiResult.name, status: 'PENDING' },
      select: { id: true },
    })
    if (!existing) {
      const suggestion = await prisma.categorySuggestion.create({
        data: {
          familyId,
          suggestedName: aiResult.name,
          exampleMerchant: merchantName || null,
          status: 'PENDING',
        },
        select: { id: true },
      })
      const adminMember = await prisma.familyMember.findFirst({
        where: { familyId, isFamilyAdmin: true },
        select: { user: { select: { phone: true } } },
      })
      if (adminMember?.user?.phone) {
        const msg = `*DOMUS sugiere nueva categoría:* "${aiResult.name}" (ej. recibo de ${merchantName || 'comercio'}).\n\n¿Quieres que la añada al presupuesto? Responde *sí* o *adhierela* a este mensaje para crearla.${getDomusLinkSuffix()}`
        const sent = await sendWhatsAppMessageAndGetSid(adminMember.user.phone, msg)
        if (sent.ok && sent.sid) {
          await prisma.categorySuggestion.update({
            where: { id: suggestion.id },
            data: { outboundMessageSid: sent.sid },
          })
        }
      }
    }
    categoryHint = (merchantName ? resolveCategoryHint(merchantName) : null) || (rawSnippet ? resolveCategoryHint(rawSnippet.slice(0, 300)) : null)
  }
  }
  if (!categoryHint) {
    categoryHint =
      (merchantName ? resolveCategoryHint(merchantName) : null) ||
      (extraction?.rawText ? resolveCategoryHint(extraction.rawText.slice(0, 300)) : null)
  }
  const assignmentFromCaption = parseAssignmentNameFromCaption(body)
  const assignmentFromImage = parseAssignmentNameFromExtraction(extraction)
  const assignmentNameHint = assignmentFromCaption || assignmentFromImage
  const allocation = await findAllocationWithDetails(familyId, {
    entityNameHint: assignmentNameHint,
    categoryHint: categoryHint || 'Gasto',
  })
  if (!allocation) {
    return { ok: false, error: 'No hay asignaciones en tu familia. Configura Presupuesto en la app.' }
  }
  if (preferenceKey && allocation.categoryId) {
    const learnedNew = await saveFamilyCategoryPreference(familyId, preferenceKey, allocation.categoryId)
    if (learnedNew) await notifyAdminPreferenceLearned(familyId, preferenceKey, allocation.categoryName)
  }
  let description = extraction?.merchantName?.trim() || 'Gasto con comprobante'
  if (containsSensitiveData(description)) description = 'Gasto con comprobante'
  const receiptDate = parseDateOnly(extraction?.date ?? null)
  const nowForDup = new Date()
  // Usar siempre "ahora" para buscar duplicados: la transacción se guarda con date = new Date(),
  // así que buscamos en ventana reciente para detectar el mismo recibo subido otra vez.
  const duplicateWarning = await findPossibleDuplicate(prisma, familyId, {
    amount: total,
    date: nowForDup,
    descriptionOrMerchant: description,
    excludeTransactionId: undefined,
  })
  if (duplicateWarning) {
    const dateStr = nowForDup.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    const timeStr = nowForDup.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const ticketData: TicketData = {
      concept: description,
      amount: Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currency: extraction?.currency ?? 'MXN',
      date: dateStr,
      time: timeStr,
      code: '—',
      classification: allocation.categoryName,
      entityName: allocation.entityName,
    }
    return {
      ok: false,
      duplicate: true,
      ticketData,
      duplicateWarning: {
        transactionId: duplicateWarning.transactionId,
        date: duplicateWarning.date,
        description: duplicateWarning.description,
        amount: duplicateWarning.amount,
      },
      message: `Posible duplicado (ya existe un gasto similar: $${duplicateWarning.amount}, ${duplicateWarning.date}). Este comprobante *no se registró*. ¿Descartar o enviar el correcto? Responde *descartar*, *cancelar*, *no* (o envía la foto correcta) y te confirmamos.`,
    }
  }
  const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
  const pendingReason = allocation.assignedByName ? null : 'categoría y usuario'
  const tx = await prisma.transaction.create({
    data: {
      familyId,
      userId: user.id,
      allocationId: allocation.allocationId,
      amount: String(Math.round(total * 100) / 100),
      date: new Date(),
      description,
      registrationCode,
      pendingReason,
    },
    select: { id: true, registrationCode: true },
  })
  const ext = contentType.toLowerCase().includes('png') ? 'png' : 'jpg'
  let fileUrl: string
  try {
    const key = `families/${familyId}/receipts/whatsapp-${Date.now()}.${ext}`
    fileUrl = await uploadToSpaces({
      key,
      body: imageBytes,
      contentType: contentType || 'image/jpeg',
    })
  } catch (e) {
    console.warn('WhatsApp: no se pudo subir la imagen a Spaces (configura DO_SPACES_*):', e)
    fileUrl = 'whatsapp://no-storage'
  }
  const receipt = await prisma.receipt.create({
    data: {
      transactionId: tx.id,
      userId: user.id,
      familyId,
      fileUrl,
      images: { create: [{ fileUrl, sortOrder: 1 }] },
    },
    select: { id: true },
  })
  const receiptExt = await prisma.receiptExtraction.create({
    data: {
      receiptId: receipt.id,
      familyId,
      userId: user.id,
      merchantName: extraction.merchantName ?? null,
      receiptDate,
      total: asDecimalString(extraction.total, 2),
      currency: extraction.currency ?? null,
      tax: asDecimalString(extraction.tax, 2),
      tip: asDecimalString(extraction.tip, 2),
      rawText: extraction.rawText ?? null,
      rawJson: JSON.stringify(extraction.raw ?? {}),
      metaJson: JSON.stringify(extraction.meta ?? {}),
    },
    select: { id: true },
  })
  if (extraction.items?.length) {
    await prisma.receiptExtractionItem.createMany({
      data: extraction.items.map((it) => ({
        extractionId: receiptExt.id,
        lineNumber: it.lineNumber ?? 0,
        description: it.description ?? '',
        rawLine: it.rawLine ?? null,
        quantity: asDecimalString(it.quantity, 3),
        unitPrice: asDecimalString(it.unitPrice, 2),
        amount: asDecimalString(it.amount, 2),
        isAdjustment: !!it.isAdjustment,
        isPlaceholder: !!it.isPlaceholder,
        lineType: it.lineType ?? null,
        notesJson: JSON.stringify(it.notes ?? {}),
        quantityUnit: it.quantityUnit ?? null,
      })),
    })
  }
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const senderName = user.name || user.email || 'Usuario'
  const code = tx.registrationCode ?? '—'
  const confirmMsg = [
    '✓ *Recibo registrado*',
    '',
    `*Concepto:* ${description}`,
    `*Monto:* $${Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `*Fecha:* ${dateStr}, ${timeStr}`,
    `*Clave:* ${code}`,
    `*Enviado por:* ${senderName}`,
    '',
    `_Clasificación:_ ${allocation.categoryName} → ${allocation.entityName}.`,
  ].join('\n')
  const missingAssignmentLine = allocation.assignedByName
    ? ''
    : `\n_Pendiente:_ indica "para [nombre]" o reasigna:\n${code} cumpleaños Sofía`
  const ticketData: TicketData = {
    concept: description,
    amount: Number(total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    currency: extraction.currency ?? 'MXN',
    date: dateStr,
    time: timeStr,
    code,
    classification: allocation.categoryName,
    entityName: allocation.entityName,
  }
  return { ok: true, message: confirmMsg + missingAssignmentLine, transactionId: tx.id, ticketData }
}

async function handleImageMessage(args: {
  mediaUrl0: string
  body: string | null
  user: { id: string; name: string | null; email: string }
  familyId: string
  messageSid: string
  fromPhone: string
}): Promise<Response> {
  const { mediaUrl0, body, user, familyId, fromPhone } = args
  let imageBytes: Buffer
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const headers: Record<string, string> = {}
    if (sid && token) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
    }
    const res = await fetch(mediaUrl0, { headers })
    if (!res.ok) throw new Error(`Download: ${res.status}`)
    imageBytes = Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error('Download image:', e)
    return createTwiMLResponse('No se pudo descargar la imagen. Intenta de nuevo.')
  }
  const contentType = 'image/jpeg'
  const result = await processReceiptFromImageBytes(imageBytes, contentType, body, user, familyId)
  if (!result.ok) {
    if ('duplicate' in result && result.duplicate) {
      try {
        const redTicketPng = await generateRejectedTicketImagePng({ ...result.ticketData, reason: 'Duplicado' })
        const ticketKey = `families/${familyId}/receipts/rejected-${Date.now()}.png`
        await uploadToSpaces({ key: ticketKey, body: redTicketPng, contentType: 'image/png' })
        const ticketUrl = await getSignedDownloadUrl({ key: ticketKey, expiresInSeconds: 3600 })
        await sendWhatsAppWithMediaAndGetSid(normalizePhone(fromPhone), ticketUrl, {
          body: result.message + getDomusLinkSuffix(),
        })
      } catch (e) {
        console.warn('WhatsApp recibo rojo fallback to text:', e)
        return createTwiMLResponse(result.message + getDomusLinkSuffix())
      }
      return createTwiMLResponse('')
    }
    return createTwiMLResponse('error' in result ? result.error : 'No se pudo procesar el recibo.')
  }
  const phone = normalizePhone(fromPhone)
  const shortCaption = `Clave: ${result.ticketData.code}. Responde a este mensaje para reasignar (ej. para Sofía).`
  try {
    const ticketPng = await generateTicketImagePng(result.ticketData)
    const ticketKey = `families/${familyId}/receipts/ticket-${result.transactionId}-${Date.now()}.png`
    await uploadToSpaces({
      key: ticketKey,
      body: ticketPng,
      contentType: 'image/png',
    })
    const ticketUrl = await getSignedDownloadUrl({ key: ticketKey, expiresInSeconds: 3600 })
    const sent = await sendWhatsAppWithMediaAndGetSid(phone, ticketUrl, { body: shortCaption + getDomusLinkSuffix() })
    if (sent.ok && sent.sid) {
      await prisma.receiptConfirmationMessage.create({
        data: { messageSid: sent.sid, transactionId: result.transactionId, familyId },
      })
      return createTwiMLResponse('')
    }
  } catch (e) {
    console.warn('WhatsApp ticket image fallback to text:', e)
  }
  const sent = await sendWhatsAppMessageAndGetSid(phone, result.message + getDomusLinkSuffix())
  if (sent.ok && sent.sid) {
    await prisma.receiptConfirmationMessage.create({
      data: { messageSid: sent.sid, transactionId: result.transactionId, familyId },
    })
    return createTwiMLResponse('')
  }
  return createTwiMLResponse(result.message + getDomusLinkSuffix())
}

/** Recibe PDF (ej. factura CFE), convierte primera página a imagen y procesa como recibo. */
async function handlePdfMessage(args: {
  mediaUrl0: string
  body: string | null
  user: { id: string; name: string | null; email: string }
  familyId: string
  fromPhone: string
}): Promise<Response> {
  const { mediaUrl0, body, user, familyId, fromPhone } = args
  let pdfBuffer: Buffer
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const headers: Record<string, string> = {}
    if (sid && token) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
    }
    const res = await fetch(mediaUrl0, { headers })
    if (!res.ok) throw new Error(`Download: ${res.status}`)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error('Download PDF:', e)
    return createTwiMLResponse('No se pudo descargar el PDF. Intenta de nuevo.')
  }
  if (pdfBuffer.length < 1) return createTwiMLResponse('El archivo PDF está vacío.')
  let firstPageImage: Buffer
  try {
    const { pdf } = await import('pdf-to-img')
    const doc = await pdf(pdfBuffer, { scale: 2 })
    let first: Buffer | null = null
    for await (const page of doc) {
      first = page
      break
    }
    if (!first) return createTwiMLResponse('El PDF no tiene páginas válidas.')
    firstPageImage = first
  } catch (e) {
    console.error('PDF to image:', e)
    return createTwiMLResponse('No se pudo procesar el PDF. Envía una foto del recibo o el monto por texto (ej: 10864 CFE).')
  }
  const result = await processReceiptFromImageBytes(firstPageImage, 'image/png', body, user, familyId)
  if (!result.ok) {
    if ('duplicate' in result && result.duplicate) {
      try {
        const redTicketPng = await generateRejectedTicketImagePng({ ...result.ticketData, reason: 'Duplicado' })
        const ticketKey = `families/${familyId}/receipts/rejected-pdf-${Date.now()}.png`
        await uploadToSpaces({ key: ticketKey, body: redTicketPng, contentType: 'image/png' })
        const ticketUrl = await getSignedDownloadUrl({ key: ticketKey, expiresInSeconds: 3600 })
        await sendWhatsAppWithMediaAndGetSid(normalizePhone(fromPhone), ticketUrl, {
          body: result.message + getDomusLinkSuffix(),
        })
      } catch (e) {
        console.warn('WhatsApp PDF recibo rojo fallback to text:', e)
        return createTwiMLResponse(result.message + getDomusLinkSuffix())
      }
      return createTwiMLResponse('')
    }
    return createTwiMLResponse('error' in result ? result.error : 'No se pudo procesar el recibo.')
  }
  const phone = normalizePhone(fromPhone)
  const shortCaption = `Clave: ${result.ticketData.code}. Responde a este mensaje para reasignar (ej. para Sofía).`
  try {
    const ticketPng = await generateTicketImagePng(result.ticketData)
    const ticketKey = `families/${familyId}/receipts/ticket-${result.transactionId}-${Date.now()}.png`
    await uploadToSpaces({
      key: ticketKey,
      body: ticketPng,
      contentType: 'image/png',
    })
    const ticketUrl = await getSignedDownloadUrl({ key: ticketKey, expiresInSeconds: 3600 })
    const sent = await sendWhatsAppWithMediaAndGetSid(phone, ticketUrl, { body: shortCaption + getDomusLinkSuffix() })
    if (sent.ok && sent.sid) {
      await prisma.receiptConfirmationMessage.create({
        data: { messageSid: sent.sid, transactionId: result.transactionId, familyId },
      })
      return createTwiMLResponse('')
    }
  } catch (e) {
    console.warn('WhatsApp PDF ticket image fallback to text:', e)
  }
  const sent = await sendWhatsAppMessageAndGetSid(phone, result.message + getDomusLinkSuffix())
  if (sent.ok && sent.sid) {
    await prisma.receiptConfirmationMessage.create({
      data: { messageSid: sent.sid, transactionId: result.transactionId, familyId },
    })
    return createTwiMLResponse('')
  }
  return createTwiMLResponse(result.message + getDomusLinkSuffix())
}

/** Responde al mensaje de sugerencia de categoría: "sí" o "adhierela" → crear categoría y partidas. */
async function handleReplyToCategorySuggestion(args: {
  referredMessageSid: string
  body: string
  familyId: string
  isFamilyAdmin: boolean
}): Promise<Response | null> {
  const { referredMessageSid, body, familyId, isFamilyAdmin } = args
  const sug = await prisma.categorySuggestion.findFirst({
    where: { familyId, outboundMessageSid: referredMessageSid, status: 'PENDING' },
    select: { id: true, suggestedName: true },
  })
  if (!sug) return null
  const t = body.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')
  const isApproval =
    /^(si|sí|sip|yes|ok|dale|adhierela|adhiera|creala|crearla|añadela|añadirla|agregala)$/.test(t) ||
    /^sí,?\s*(adhierela|creala)?$/i.test(body.trim())
  if (!isApproval) {
    return createTwiMLResponse('Responde *sí* o *adhierela* para crear la categoría, o ignora el mensaje para dejarla pendiente.')
  }
  if (!isFamilyAdmin) {
    return createTwiMLResponse('Solo el administrador de la familia puede aprobar nuevas categorías.')
  }
  const existingCat = await prisma.budgetCategory.findFirst({
    where: { familyId, name: sug.suggestedName, isActive: true },
    select: { id: true },
  })
  if (existingCat) {
    await prisma.categorySuggestion.update({
      where: { id: sug.id },
      data: { status: 'APPROVED', resolvedAt: new Date() },
    })
    return createTwiMLResponse(`La categoría "${sug.suggestedName}" ya existe en tu presupuesto.`)
  }
  const entities = await prisma.budgetEntity.findMany({
    where: { familyId, isActive: true, participatesInBudget: true },
    select: { id: true },
  })
  const category = await prisma.budgetCategory.create({
    data: { familyId, name: sug.suggestedName, type: 'EXPENSE', isActive: true },
    select: { id: true, name: true },
  })
  for (const ent of entities) {
    await prisma.entityBudgetAllocation.create({
      data: {
        familyId,
        entityId: ent.id,
        categoryId: category.id,
        monthlyLimit: 0,
        isActive: true,
      },
    })
  }
  await prisma.categorySuggestion.update({
    where: { id: sug.id },
    data: { status: 'APPROVED', resolvedAt: new Date() },
  })
  return createTwiMLResponse(
    `Categoría *${category.name}* creada y añadida a todas las partidas. Ya puedes usarla al registrar gastos o reasignar.`,
  )
}

/** Responde al mensaje de confirmación de recibo (ej. "es para Sofía", "cumpleaños Sofía") para reasignar. */
async function handleReplyToReceiptConfirmation(args: {
  referredMessageSid: string
  body: string
  familyId: string
}): Promise<Response | null> {
  const { referredMessageSid, body, familyId } = args
  const rec = await prisma.receiptConfirmationMessage.findUnique({
    where: { messageSid: referredMessageSid },
    select: { transactionId: true, familyId: true },
  })
  if (!rec || rec.familyId !== familyId) return null
  const txByCode = await prisma.transaction.findFirst({
    where: { id: rec.transactionId, familyId },
    select: {
      id: true,
      description: true,
      allocationId: true,
      allocation: { select: { entity: { select: { name: true } }, category: { select: { name: true } } } },
    },
  })
  if (!txByCode) return null
  const [entityNamesReply, categoryNamesReply] = await Promise.all([
    prisma.budgetEntity.findMany({
      where: { familyId, isActive: true },
      select: { name: true },
    }).then((e) => e.map((x) => x.name)),
    prisma.budgetCategory.findMany({
      where: { familyId, isActive: true },
      select: { name: true },
    }).then((c) => c.map((x) => x.name)),
  ])
  const hintsFromIa = await parseReassignHints(body, { entityNames: entityNamesReply, categoryNames: categoryNamesReply })
  const fallback = parseConceptAndEntityForReassign(body)
  const categoryHint = hintsFromIa.categoryHint || fallback.categoryHint
  const entityHint = hintsFromIa.entityHint || fallback.entityHint
  const currentCategory = (txByCode as any).allocation?.category?.name ?? null
  const hasExplicitCategoryInMessage = !!resolveCategoryHint(body)
  const categoryHintToUse = hasExplicitCategoryInMessage
    ? (categoryHint || body)
    : (currentCategory || categoryHint || body)
  const allocation = await findAllocationWithDetails(familyId, {
    entityNameHint: entityHint,
    categoryHint: categoryHintToUse,
  })
  if (!allocation) {
    return createTwiMLResponse('No hay asignaciones que coincidan. Indica partida/categoría (ej. cumpleaños Sofía).')
  }
  const prevEntity = (txByCode as any).allocation?.entity?.name ?? '—'
  const prevCategory = (txByCode as any).allocation?.category?.name ?? '—'
  const categoryChanged = prevCategory !== allocation.categoryName
  await prisma.transaction.update({
    where: { id: rec.transactionId },
    data: { allocationId: allocation.allocationId, pendingReason: null },
  })
  if (categoryChanged && allocation.categoryId) {
    const desc = (txByCode as any).description
    const key = typeof desc === 'string' && desc.trim() ? norm(desc.trim().slice(0, 150)) : null
    if (key && key.length >= 2) {
      const learnedNew = await saveFamilyCategoryPreference(familyId, key, allocation.categoryId)
      if (learnedNew) await notifyAdminPreferenceLearned(familyId, key, allocation.categoryName)
    }
  }
  const now = new Date()
  const ts = now.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const msg = `${ts} — Transacción actualizada. Cambio de ${prevEntity} / ${prevCategory} a ${allocation.entityName} / ${allocation.categoryName}.`
  return createTwiMLResponse(msg)
}

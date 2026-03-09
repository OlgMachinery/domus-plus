/**
 * Código de registro de transacción (estilo aeronáutico).
 * Formato: E-XXXX (egreso) o I-XXXX (ingreso); 4 letras A–Z → 26^4 = 456.976 códigos por tipo.
 * Unicidad por familia: @@unique([familyId, registrationCode]).
 */

/** Acepta PrismaClient o el cliente de transacción (tx) dentro de $transaction. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaLike = { transaction: { findFirst: (args: any) => Promise<{ id: string } | null> } }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randomFourLetters(): string {
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += LETTERS[Math.floor(Math.random() * LETTERS.length)]!
  }
  return s
}

export type RegistrationCodeType = 'E' | 'I'

/**
 * Genera un código de registro único para la familia.
 * E = egreso, I = ingreso. Reintenta hasta 5 veces si hay colisión.
 */
export async function generateRegistrationCode(
  prisma: PrismaLike,
  familyId: string,
  type: RegistrationCodeType,
): Promise<string> {
  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = `${type}-${randomFourLetters()}`
    const existing = await prisma.transaction.findFirst({
      where: { familyId, registrationCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }
  // Muy improbable: usar timestamp base36 para desempatar
  const fallback = `${type}-${Date.now().toString(36).toUpperCase().slice(-4).padStart(4, 'A')}`
  return fallback
}

/** Indica si una transacción es ingreso (I) o egreso (E) según su código. */
export function registrationCodeType(code: string | null): RegistrationCodeType | null {
  if (!code || code.length < 2) return null
  const t = code[0]?.toUpperCase()
  if (t === 'E' || t === 'I') return t
  return null
}

/** Prisma-like con moneyRequest para códigos de solicitud. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaLikeMoneyRequest = { moneyRequest: { findFirst: (args: any) => Promise<{ id: string } | null> } }

/**
 * Genera un código de registro único para solicitud de efectivo (S-XXXX).
 * Unicidad por familia: @@unique([familyId, registrationCode]) en MoneyRequest.
 */
export async function generateMoneyRequestRegistrationCode(
  prisma: PrismaLikeMoneyRequest,
  familyId: string,
): Promise<string> {
  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = `S-${randomFourLetters()}`
    const existing = await prisma.moneyRequest.findFirst({
      where: { familyId, registrationCode: code },
      select: { id: true },
    })
    if (!existing) return code
  }
  const fallback = `S-${Date.now().toString(36).toUpperCase().slice(-4).padStart(4, 'A')}`
  return fallback
}

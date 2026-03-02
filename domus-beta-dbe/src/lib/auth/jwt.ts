import { SignJWT, jwtVerify } from 'jose'

type TokenPayload = {
  userId: string
  familyId: string | null
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Falta JWT_SECRET en el entorno')
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: TokenPayload) {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ familyId: payload.familyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt(now)
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
  const userId = typeof payload.sub === 'string' ? payload.sub : null
  const familyId = payload.familyId
  if (!userId) throw new Error('Token inválido')
  return {
    userId,
    familyId: typeof familyId === 'string' ? familyId : null,
  }
}


import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let cached: S3Client | null = null

export function getSpacesClient() {
  if (cached) return cached

  const endpoint = process.env.DO_SPACES_ENDPOINT
  const region = process.env.DO_SPACES_REGION
  const key = process.env.DO_SPACES_KEY
  const secret = process.env.DO_SPACES_SECRET

  if (!endpoint || !region || !key || !secret) {
    throw new Error('Faltan variables DO_SPACES_* en el entorno')
  }

  cached = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  })

  return cached
}

export function getSpacesBucket() {
  const bucket = process.env.DO_SPACES_BUCKET
  if (!bucket) throw new Error('Falta DO_SPACES_BUCKET en el entorno')
  return bucket
}

export function buildSpacesUrl(key: string) {
  const endpoint = process.env.DO_SPACES_ENDPOINT
  const bucket = process.env.DO_SPACES_BUCKET
  if (!endpoint || !bucket) throw new Error('Falta configuración de Spaces')
  const cleanEndpoint = endpoint.replace(/\/+$/, '')
  const cleanKey = key.replace(/^\/+/, '')
  return `${cleanEndpoint}/${bucket}/${cleanKey}`
}

export async function uploadToSpaces(args: {
  key: string
  body: Uint8Array | Buffer
  contentType?: string
}) {
  const client = getSpacesClient()
  const bucket = getSpacesBucket()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      ACL: 'private',
    })
  )
  return buildSpacesUrl(args.key)
}

export function extractKeyFromSpacesUrl(fileUrl: string) {
  const endpoint = process.env.DO_SPACES_ENDPOINT?.replace(/\/+$/, '')
  const bucket = process.env.DO_SPACES_BUCKET
  if (!endpoint || !bucket) return null
  const prefix = `${endpoint}/${bucket}/`
  if (fileUrl.startsWith(prefix)) return fileUrl.slice(prefix.length)
  // fallback simple
  const idx = fileUrl.indexOf(`/${bucket}/`)
  if (idx >= 0) return fileUrl.slice(idx + bucket.length + 2)
  return null
}

export async function getSignedDownloadUrl(args: { key: string; expiresInSeconds?: number }) {
  const client = getSpacesClient()
  const bucket = getSpacesBucket()
  const expiresIn = typeof args.expiresInSeconds === 'number' ? args.expiresInSeconds : 60 * 10
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: args.key,
    }),
    { expiresIn }
  )
}


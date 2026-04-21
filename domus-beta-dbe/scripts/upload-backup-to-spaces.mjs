#!/usr/bin/env node
/**
 * Sube una copia de respaldo del repo a DigitalOcean Spaces.
 * Uso: node scripts/upload-backup-to-spaces.mjs [ruta-del.tar.gz]
 * Si no pasas ruta, usa el último domus-plus-respaldo-*.tar.gz del Escritorio.
 * Requiere DO_SPACES_* en .env (o en el entorno).
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { config } from 'dotenv'

const __dirname = new URL('.', import.meta.url).pathname
const root = join(__dirname, '..')

// Cargar .env desde domus-beta-dbe
config({ path: join(root, '.env') })

const endpoint = process.env.DO_SPACES_ENDPOINT
const region = process.env.DO_SPACES_REGION
const key = process.env.DO_SPACES_KEY
const secret = process.env.DO_SPACES_SECRET
const bucket = process.env.DO_SPACES_BUCKET

if (!endpoint || !region || !key || !secret || !bucket) {
  console.error('Faltan variables DO_SPACES_* (DO_SPACES_ENDPOINT, REGION, KEY, SECRET, BUCKET).')
  console.error('Configúralas en domus-beta-dbe/.env o en el entorno.')
  process.exit(1)
}

function findBackupFile() {
  const desktop = join(process.env.HOME || '', 'Desktop')
  const arg = process.argv[2]
  if (arg && existsSync(arg)) return arg
  if (existsSync(desktop)) {
    const files = readdirSync(desktop)
      .filter((f) => f.startsWith('domus-plus-respaldo-') && f.endsWith('.tar.gz'))
      .map((f) => {
        const path = join(desktop, f)
        return { name: f, path, mtime: statSync(path).mtime }
      })
    if (files.length) {
      files.sort((a, b) => b.mtime - a.mtime)
      return files[0].path
    }
  }
  return null
}

async function main() {
  const backupPath = await findBackupFile()
  if (!backupPath) {
    console.error('No se encontró archivo de respaldo.')
    console.error('Crea uno con: tar -czf ~/Desktop/domus-plus-respaldo-$(date +%Y%m%d).tar.gz -C /ruta/domus-plus --exclude=.git --exclude=node_modules --exclude=.next .')
    process.exit(1)
  }

  const fileName = backupPath.split('/').pop()
  const spacesKey = `backups/domus-plus/${fileName}`

  console.log('Leyendo:', backupPath)
  const body = readFileSync(backupPath)
  console.log('Tamaño:', (body.length / 1024 / 1024).toFixed(2), 'MB')

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  })

  console.log('Subiendo a Spaces:', bucket, spacesKey)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: spacesKey,
      Body: body,
      ContentType: 'application/gzip',
      ACL: 'private',
    })
  )

  const baseUrl = endpoint.replace(/\/+$/, '')
  console.log('Listo. Objeto:', `${baseUrl}/${bucket}/${spacesKey}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

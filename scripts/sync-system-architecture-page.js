#!/usr/bin/env node
/**
 * Copia la página de arquitectura del sistema desde la fuente canónica (domus-beta-dbe)
 * a app/ y frontend/, para que solo se mantenga un archivo.
 *
 * Uso (desde la raíz del repo): node scripts/sync-system-architecture-page.js
 *
 * Fuente canónica: domus-beta-dbe/src/app/ui/system-architecture/page.tsx
 * Solo editar ese archivo; luego ejecutar este script para actualizar app y frontend.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'domus-beta-dbe/src/app/ui/system-architecture/page.tsx')
const TARGETS = [
  path.join(ROOT, 'app/ui/system-architecture/page.tsx'),
  path.join(ROOT, 'frontend/app/ui/system-architecture/page.tsx'),
]

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Fuente no encontrada:', SOURCE)
    process.exit(1)
  }

  let content = fs.readFileSync(SOURCE, 'utf8')
  // Asegurar que la directiva sea correcta (por si hubo typo en algún clone)
  content = content.replace(/^['"]?si'use client'['"]?\s*\n/, "'use client'\n")

  for (const target of TARGETS) {
    const dir = path.dirname(target)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(target, content, 'utf8')
    console.log('OK', path.relative(ROOT, target))
  }

  console.log('Sincronización completada. Fuente canónica: domus-beta-dbe/.../page.tsx')
}

main()

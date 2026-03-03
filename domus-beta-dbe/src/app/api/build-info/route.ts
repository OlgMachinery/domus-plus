import { NextResponse } from 'next/server'

/**
 * Para verificar que domus-fam.com despliega ESTE proyecto (domus-beta-dbe) con el código actual.
 * Si ves { "build": "diagrama-ok", "slugRemoved": true } → el deploy es el correcto y /diagrama debe mostrar el diagrama.
 * Si da 404 → el dominio no apunta a este proyecto.
 */
/** Versión para confirmar que el deploy incluye el mensaje verde y sin borde rojo */
const BUILD_VERSION = '2026-02-26-reticula-teal'

export async function GET() {
  return NextResponse.json({
    build: 'diagrama-ok',
    slugRemoved: true,
    project: 'domus-beta-dbe',
    version: BUILD_VERSION,
    message: 'Si ves esto, el deploy es domus-beta-dbe. Debes ver el pill verde en el Dashboard.',
  })
}

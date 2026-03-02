import { NextResponse } from 'next/server'

/**
 * Para verificar que domus-fam.com despliega ESTE proyecto (domus-beta-dbe) con el código actual.
 * Si ves { "build": "diagrama-ok", "slugRemoved": true } → el deploy es el correcto y /diagrama debe mostrar el diagrama.
 * Si da 404 → el dominio no apunta a este proyecto.
 */
export async function GET() {
  return NextResponse.json({
    build: 'diagrama-ok',
    slugRemoved: true,
    project: 'domus-beta-dbe',
  })
}

'use client'

import { Suspense } from 'react'
import SystemArchitecturePage from '@/app/ui/system-architecture/page'

/**
 * Ruta /diagrama: misma vista compacta que /ui/system-architecture.
 * Página real para que [slug] no capture /diagrama y devuelva Hello diagrama!
 */
export const dynamic = 'force-dynamic'

export default function DiagramaPage() {
  return (
    <Suspense fallback={null}>
      <SystemArchitecturePage />
    </Suspense>
  )
}

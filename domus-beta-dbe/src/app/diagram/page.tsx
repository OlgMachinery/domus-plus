'use client'

import { Suspense } from 'react'
import SystemArchitecturePage from '@/app/ui/system-architecture/page'

/**
 * Ruta /diagram: misma vista compacta que /ui/system-architecture.
 * Página real para que [slug] no capture /diagram y devuelva Hello diagram!
 */
export const dynamic = 'force-dynamic'

export default function DiagramPage() {
  return (
    <Suspense fallback={null}>
      <SystemArchitecturePage />
    </Suspense>
  )
}

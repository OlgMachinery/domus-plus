'use client'

import SystemArchitecturePage from '@/app/ui/system-architecture/page'

/**
 * Ruta /diagram: misma vista compacta que /ui/system-architecture.
 * Página real para que [slug] no capture /diagram y devuelva Hello diagram!
 */
export default function DiagramPage() {
  return <SystemArchitecturePage />
}

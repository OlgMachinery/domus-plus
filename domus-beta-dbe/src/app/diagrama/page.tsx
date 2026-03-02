'use client'

import SystemArchitecturePage from '@/app/ui/system-architecture/page'

/**
 * Ruta /diagrama: misma vista compacta que /ui/system-architecture.
 * Página real para que [slug] no capture /diagrama y devuelva Hello diagrama!
 */
export default function DiagramaPage() {
  return <SystemArchitecturePage />
}

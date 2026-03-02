'use client'

import SystemArchitecturePage from '@/app/ui/system-architecture/page'

/**
 * Ruta /diagrama: misma vista compacta del diagrama de arquitectura.
 * Existe solo en el código actual para evitar caché o builds antiguos en /ui/system-*.
 */
export default function DiagramaPage() {
  return <SystemArchitecturePage />
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /ui/system-a: redirige a la vista compacta del diagrama.
 * Evita que se sirva una versión antigua o que la URL quede sin manejar.
 */
export default function SystemAPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ui/system-architecture')
  }, [router])
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      Redirigiendo al diagrama…
    </div>
  )
}

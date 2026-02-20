import { ReactNode } from 'react'

// Evita que Next intente pre-renderizar rutas API en build (usan cookies/headers vía Supabase).
export const dynamic = 'force-dynamic'

export default function ApiLayout({ children }: { children: ReactNode }) {
  return children
}

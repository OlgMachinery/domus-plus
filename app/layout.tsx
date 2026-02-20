import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

// Evita que el build intente pre-renderizar páginas que usan cookies/headers (Supabase).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'DOMUS+',
  description: 'Family Budget Management System',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}

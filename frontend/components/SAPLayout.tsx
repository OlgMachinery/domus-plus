'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@/lib/types'
import { useTranslation, getLanguage, type Language } from '@/lib/i18n'
import AIAssistant from './AIAssistant'

interface SAPLayoutProps {
  children: ReactNode
  user?: User | null
  title: string
  subtitle?: string
  toolbar?: ReactNode
}

export default function SAPLayout({ children, user, title, subtitle, toolbar }: SAPLayoutProps) {
  const pathname = usePathname()
  const [language, setLanguage] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)

  useEffect(() => {
    setMounted(true)
    const initialLang = getLanguage()
    setLanguage(initialLang)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const handleStorageChange = () => {
      const newLang = getLanguage()
      setLanguage(newLang)
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      const interval = setInterval(() => {
        const currentLang = getLanguage()
        setLanguage(prevLang => {
          if (currentLang !== prevLang) {
            return currentLang
          }
          return prevLang
        })
      }, 1000) // Reducido a 1 segundo para mejor rendimiento
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        clearInterval(interval)
      }
    }
  }, [mounted])

  const menuItems = [
    { href: '/dashboard', label: t.nav.dashboard, active: pathname === '/dashboard' },
    { href: '/budgets', label: t.nav.budgets, active: pathname === '/budgets' },
    { href: '/personal-budget', label: t.nav.personalBudget, active: pathname === '/personal-budget' },
    { href: '/transactions', label: t.nav.transactions, active: pathname === '/transactions' },
    { href: '/budget-summary', label: t.nav.budgetSummary, active: pathname === '/budget-summary' },
    { href: '/receipts', label: t.nav.receipts, active: pathname === '/receipts' },
    { href: '/user-records', label: t.nav.userRecords, active: pathname === '/user-records' },
    { href: '/reports', label: t.nav.reports, active: pathname === '/reports' },
    { href: '/custom-categories', label: language === 'es' ? 'Categorías Personalizadas' : 'Custom Categories', active: pathname === '/custom-categories' },
    { href: '/logs', label: t.nav.logs, active: pathname === '/logs' },
  ]

  return (
    <div className="h-screen bg-sap-bg flex overflow-hidden">
      {/* Sidebar estilo SAP - más delgado */}
      <aside className="sap-sidebar w-48 flex-shrink-0 flex flex-col">
        {/* Header del sidebar */}
        <div className="px-3 py-3 border-b border-sap-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sap-primary rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">D+</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-xs truncate">DOMUS+</h1>
              <p className="text-xs text-sap-text-secondary text-white/70 truncate">{t.nav.system}</p>
            </div>
          </div>
          {user && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-xs text-white/90 font-medium truncate" title={user.name}>{user.name}</p>
              <p className="text-xs text-white/60 truncate" title={user.email}>{user.email}</p>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-1.5 py-3 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded mb-0.5 transition-colors ${
                item.active
                  ? 'bg-sap-primary text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              title={item.label}
            >
              <span className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                {item.active && <span className="w-0.5 h-3 bg-white rounded-full" />}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer del sidebar */}
        <div className="px-3 py-2 border-t border-white/10">
          <Link
            href="/login"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white rounded transition-colors"
          >
            <span className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{t.nav.logout}</span>
          </Link>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col bg-sap-bg overflow-hidden" style={{ position: 'relative' }}>
        {/* Toolbar estilo SAP - estático */}
        <div className="sap-toolbar fixed top-0 left-48 right-0 z-30 bg-white border-b border-sap-border px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0 overflow-hidden">
            <h1 className="text-lg font-semibold text-sap-text truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-sap-text-secondary mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
        </div>

        {/* Contenido de la página - con scroll */}
        <div 
          className="sap-page flex-1 overflow-y-auto px-6 py-4" 
          style={{ 
            marginTop: '73px', 
            height: 'calc(100vh - 73px)',
            overflow: 'auto'
          }}
        >
          {children}
        </div>
      </main>

      {/* Asistente de IA */}
      <AIAssistant language={language} />
    </div>
  )
}

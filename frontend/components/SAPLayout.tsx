'use client'

import { ReactNode, useState, useEffect, type ElementType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@/lib/types'
import { useTranslation, getLanguage, type Language } from '@/lib/i18n'
import AIAssistant from './AIAssistant'
import { supabase } from '@/lib/supabase/client'
import {
  House,
  Wallet,
  Bank,
  ArrowsLeftRight,
  ChartPieSlice,
  ChartDonut,
  Receipt,
  FileXls,
  Files,
  ChartBar,
  ListPlus,
  Scroll,
  Users
} from '@phosphor-icons/react'

interface SAPLayoutProps {
  children: ReactNode
  user?: Partial<User> | null
  title: string
  subtitle?: string
  toolbar?: ReactNode
}

interface MenuItem {
  href: string
  label: string
  active: boolean
  icon: ElementType
}

export default function SAPLayout({ children, user, title, subtitle, toolbar }: SAPLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [language, setLanguage] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)

  useEffect(() => {
    setMounted(true)
    setLanguage(getLanguage())
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

  const menuItems: MenuItem[] = [
    { href: '/dashboard', label: t.nav.dashboard, active: pathname === '/dashboard', icon: House },
    { href: '/budgets', label: t.nav.budgets, active: pathname === '/budgets', icon: Wallet },
    { href: '/family', label: language === 'es' ? 'Familia' : 'Family', active: pathname === '/family', icon: Users },
    { href: '/personal-budget', label: t.nav.personalBudget, active: pathname === '/personal-budget', icon: Bank },
    { href: '/transactions', label: t.nav.transactions, active: pathname === '/transactions', icon: ArrowsLeftRight },
    { href: '/budget-summary', label: t.nav.budgetSummary, active: pathname === '/budget-summary', icon: ChartPieSlice },
    { href: '/budget-overview', label: language === 'es' ? 'Resumen por entidad' : 'Budget overview', active: pathname === '/budget-overview', icon: ChartDonut },
    { href: '/receipts', label: t.nav.receipts, active: pathname === '/receipts', icon: Receipt },
    { href: '/excel', label: language === 'es' ? 'Importar Excel' : 'Import Excel', active: pathname === '/excel', icon: FileXls },
    { href: '/user-records', label: t.nav.userRecords, active: pathname === '/user-records', icon: Files },
    { href: '/reports', label: t.nav.reports, active: pathname === '/reports', icon: ChartBar },
    { href: '/custom-categories', label: language === 'es' ? 'Categorías Personalizadas' : 'Custom Categories', active: pathname === '/custom-categories', icon: ListPlus },
    { href: '/logs', label: t.nav.logs, active: pathname === '/logs', icon: Scroll },
    ...(user?.is_family_admin ? [{ href: '/users', label: language === 'es' ? 'Usuarios' : 'Users', active: pathname === '/users', icon: Users }] : []),
  ]

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('domus_token')
        localStorage.removeItem('token')
      }
    } catch {}
    try {
      await supabase.auth.signOut()
    } catch {}
    router.push('/login')
  }

  return (
    <div className="h-screen bg-sap-bg flex overflow-hidden">
      {/* Sidebar — navegación principal */}
      <aside className="sap-sidebar w-52 flex-shrink-0 flex flex-col">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sap-primary rounded-domus flex items-center justify-center flex-shrink-0 shadow-elevation-1">
              <span className="text-white font-bold text-sm tracking-tight">DF</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm tracking-tight truncate">Domus Fam</h1>
              <p className="text-caption text-white/60 truncate">{t.nav.system}</p>
            </div>
          </div>
          {user && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-caption text-white/90 font-medium truncate" title={user.name}>{user.name}</p>
              <p className="text-caption text-white/50 truncate" title={user.email}>{user.email}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 overflow-y-auto" aria-label="Navegación principal">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-sm rounded-domus mb-0.5 transition-all duration-200 ease-smooth ${
                item.active
                  ? 'bg-sap-primary text-white shadow-elevation-1 border-l-2 border-l-white/30 -ml-0.5 pl-3.5'
                  : 'text-white/85 hover:bg-white/10 hover:text-white border-l-2 border-l-transparent'
              }`}
              title={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {item.active && <span className="w-0.5 h-4 bg-white rounded-full" />}
              </span>
              <span className="flex items-center min-w-0">
                {item.icon && <item.icon size={20} weight="regular" className="mr-2 text-sap-muted" />}
                <span className="truncate">{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-sm text-white/80 hover:bg-white/10 hover:text-white rounded-domus transition-colors focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-sap-sidebar"
          >
            <span className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{t.nav.logout}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-sap-bg overflow-hidden" style={{ position: 'relative' }}>
        <header className="sap-toolbar fixed top-0 left-52 right-0 z-30 flex items-center gap-4">
          <div className="flex-1 min-w-0 overflow-hidden">
            <h1 className="text-title text-sap-text truncate">{title}</h1>
            {subtitle && (
              <p className="text-body text-sap-text-secondary mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {toolbar && <div className="flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
        </header>

        <div
          className="sap-page flex-1 overflow-y-auto px-6 py-5"
          style={{
            marginTop: '72px',
            height: 'calc(100vh - 72px)',
            overflow: 'auto',
          }}
        >
          {/* Indicador visible: si ves esta barra, estás en el código actualizado */}
          <div className="bg-sap-primary text-white text-center py-2 px-4 text-sm font-medium rounded-domus mb-4 shadow-elevation-1">
            Domus Fam · Gestión familiar
          </div>
          {children}
        </div>
      </main>

      {/* Asistente de IA */}
      <AIAssistant language={language} />
    </div>
  )
}

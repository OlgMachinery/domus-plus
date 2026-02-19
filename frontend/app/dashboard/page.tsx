'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { getAuthHeaders } from '@/lib/auth'
import SAPLayout from '@/components/SAPLayout'
import { formatCurrency } from '@/lib/currency'
import { getLanguage, useTranslation, type Language } from '@/lib/i18n'
import { safePushLogin } from '@/lib/receiptProcessing'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

interface DashboardStats {
  name: string
  totalBudgetMonth: number
  spentMonth: number
  remainingMonth: number
  receiptsPending: number
  recentTransactions: Array<{
    id: number
    date: string
    amount: number
    transaction_type: string
    merchant_or_beneficiary: string | null
    category: string
    concept: string | null
  }>
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [verifyStamp, setVerifyStamp] = useState<string | null>(null)
  const [lang, setLang] = useState<Language>('es')
  const t = useTranslation(lang)

  useEffect(() => {
    setLang(getLanguage())
  }, [])

  useEffect(() => {
    let mounted = true
    const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
    const apiBase = backendUrl.replace(/\/$/, '')

    const init = async () => {
      try {
        const headers = await getAuthHeaders()
        const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in headers

        if (hasAuth) {
          const meRes = await fetch(`${apiBase}/api/users/me`, {
            headers: headers as Record<string, string>,
            credentials: 'include',
          })
          if (!mounted) return
          if (meRes.ok) {
            const me = await meRes.json()
            setUser({
              id: me.id,
              email: me.email,
              user_metadata: { name: me.name },
            })
            const statsRes = await fetch(`${apiBase}/api/dashboard/stats`, {
              headers: headers as Record<string, string>,
              credentials: 'include',
            })
            if (statsRes.ok && mounted) {
              const data = await statsRes.json()
              setStats(data)
            }
            setLoading(false)
            return
          }
          if (meRes.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('domus_token')
            setLoading(false)
            return
          } else {
            // Backend temporalmente inestable: NO mandar al usuario a login.
            // Mantener la UI y permitir que el usuario recargue.
            setLoading(false)
            return
          }
        }

        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2500)
          ),
        ]) as { data: { session: any } }

        if (!mounted) return

        const { data: { session }, error } = sessionResult as { data: { session: any }; error: any }

        if (error || !session) {
          setLoading(false)
          safePushLogin(router, 'dashboard: no supabase session')
          return
        }

        setUser(session.user)

        const res = await fetch('/api/dashboard/stats', {
          headers: { Cookie: document.cookie },
        })
        if (res.ok && mounted) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        if (mounted) {
          setLoading(false)
          // Evitar “sacar” al usuario durante fallas temporales.
          const hasBackendToken = typeof window !== 'undefined' ? !!localStorage.getItem('domus_token') : false
          if (!hasBackendToken) safePushLogin(router, 'dashboard: init failed')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => {
      mounted = false
    }
  }, [router])

  const locale = lang === 'es' ? es : enUS
  const thisMonthLabel = lang === 'es' ? 'Este mes' : 'This month'
  const availableLabel = lang === 'es' ? 'Disponible' : 'Available'
  const pendingReviewLabel = lang === 'es' ? 'Pendientes de revisión' : 'Pending review'
  const recentTxLabel = lang === 'es' ? 'Transacciones recientes' : 'Recent transactions'
  const yourActivityLabel = lang === 'es' ? 'Tu última actividad' : 'Your latest activity'
  const viewAllLabel = lang === 'es' ? 'Ver todo' : 'View all'
  const welcomeLabel = lang === 'es' ? 'Bienvenido de nuevo,' : 'Welcome back,'
  const verifyLabel = lang === 'es' ? 'Verificar conexión' : 'Check connection'
  const connectedLabel = lang === 'es' ? 'Conectado:' : 'Connected:'

  return (
    <SAPLayout
      user={user ? { ...user, name: stats?.name || user.user_metadata?.name || user.email } : null}
      title="Dashboard"
      subtitle={lang === 'es' ? 'Resumen General' : 'Overview'}
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-body text-sap-text-secondary">Cargando dashboard...</p>
        </div>
      ) : user ? (
        <div className="sap-page-container space-y-6">
          {stats && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body text-sap-text-secondary">
                  {welcomeLabel} <strong className="text-sap-text">{stats.name}</strong>
                </p>
                <button
                  type="button"
                  className="sap-button-secondary text-xs py-1 px-3"
                  onClick={() => {
                    const stamp = new Date().toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')
                    setVerifyStamp(stamp)
                  }}
                >
                  {verifyLabel}
                </button>
              </div>
              {verifyStamp && (
                <p className="text-caption text-sap-text-tertiary">
                  {connectedLabel} {verifyStamp}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sap-card p-5 shadow-elevation-1">
                  <p className="text-caption text-sap-text-secondary uppercase tracking-wider">{lang === 'es' ? 'Presupuesto total' : 'Total budget'}</p>
                  <p className="text-title font-semibold text-sap-text mt-1">
                    {formatCurrency(stats.totalBudgetMonth, lang, true)}
                  </p>
                  <p className="text-caption text-sap-text-tertiary mt-0.5">{thisMonthLabel}</p>
                </div>
                <div className="sap-card p-5 shadow-elevation-1">
                  <p className="text-caption text-sap-text-secondary uppercase tracking-wider">{lang === 'es' ? 'Gastado' : 'Spent'}</p>
                  <p className="text-title font-semibold text-sap-danger mt-1">
                    {formatCurrency(stats.spentMonth, lang, true)}
                  </p>
                  <p className="text-caption text-sap-text-tertiary mt-0.5">{thisMonthLabel}</p>
                </div>
                <div className="sap-card p-5 shadow-elevation-1">
                  <p className="text-caption text-sap-text-secondary uppercase tracking-wider">{lang === 'es' ? 'Restante' : 'Remaining'}</p>
                  <p className="text-title font-semibold text-sap-success mt-1">
                    {formatCurrency(stats.remainingMonth, lang, true)}
                  </p>
                  <p className="text-caption text-sap-text-tertiary mt-0.5">{availableLabel}</p>
                </div>
                <div className="sap-card p-5 shadow-elevation-1">
                  <p className="text-caption text-sap-text-secondary uppercase tracking-wider">{lang === 'es' ? 'Recibos' : 'Receipts'}</p>
                  <p className="text-title font-semibold text-sap-text mt-1">{stats.receiptsPending}</p>
                  <p className="text-caption text-sap-text-tertiary mt-0.5">{pendingReviewLabel}</p>
                </div>
              </div>

              <div className="sap-card overflow-hidden shadow-elevation-1">
                <div className="p-4 border-b border-sap-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="sap-section-title">{recentTxLabel}</h2>
                    <p className="sap-section-subtitle">{yourActivityLabel}</p>
                  </div>
                  <Link
                    href="/transactions"
                    className="sap-button-secondary text-sm py-2"
                  >
                    {viewAllLabel}
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  {stats.recentTransactions.length === 0 ? (
                    <p className="p-6 text-body text-sap-text-secondary text-center">
                      {lang === 'es' ? 'No hay transacciones recientes.' : 'No recent transactions.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-sap-border">
                      {stats.recentTransactions.map((tx) => (
                        <li key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-sap-bg-hover/50 transition-colors">
                          <div>
                            <p className="text-body font-medium text-sap-text">
                              {tx.merchant_or_beneficiary || tx.concept || tx.category || '—'}
                            </p>
                            <p className="text-caption text-sap-text-tertiary">
                              {format(new Date(tx.date), 'MMM d, yyyy', { locale })}
                            </p>
                          </div>
                          <p className={`text-body font-medium ${tx.transaction_type === 'expense' ? 'text-sap-danger' : 'text-sap-success'}`}>
                            {tx.transaction_type === 'expense' ? '-' : '+'}
                            {formatCurrency(Math.abs(tx.amount), lang, true)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}

          {!stats && !loading && (
            <div className="sap-card p-6">
              <h2 className="sap-section-title">Bienvenido a Domus Fam</h2>
              <p className="sap-section-subtitle mt-1">
                Has iniciado sesión correctamente como: <strong className="text-sap-text">{user?.email}</strong>
              </p>
              <p className="text-body text-sap-text-secondary mt-4">
                {lang === 'es' ? 'No se pudieron cargar las estadísticas. Revisa tu conexión.' : 'Could not load stats. Check your connection.'}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </SAPLayout>
  )
}

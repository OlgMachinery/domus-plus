'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { formatCurrency } from '@/lib/currency'
import { getLanguage, useTranslation, type Language } from '@/lib/i18n'
import { getAuthHeaders } from '@/lib/auth'
import { safePushLogin } from '@/lib/receiptProcessing'
import SAPLayout from '@/components/SAPLayout'

export const dynamic = 'force-dynamic'

interface BudgetSummaryCategory {
  category_id: string
  category_name: string
  monthly_limit: number
  spent_amount: number
  remaining: number
}

interface BudgetSummaryEntity {
  entity_id: string
  entity_name: string
  total_limit: number
  total_spent: number
  remaining: number
  categories: BudgetSummaryCategory[]
}

interface BudgetSummaryResponse {
  global: { limit: number; spent: number; remaining: number }
  entities: BudgetSummaryEntity[]
}

function progressColor(percentUsed: number): string {
  if (percentUsed < 70) return 'bg-emerald-500'
  if (percentUsed <= 90) return 'bg-amber-500'
  return 'bg-red-500'
}

function ProgressBar({ limit, spent }: { limit: number; spent: number }) {
  const safeLimit = limit > 0 ? limit : 1
  const percent = Math.min(100, (spent / safeLimit) * 100)
  const color = progressColor(percent)
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default function BudgetOverviewPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [summary, setSummary] = useState<BudgetSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<Language>('es')
  const t = useTranslation(lang)
  const apiBase =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const base = apiBase.replace(/\/$/, '')

  useEffect(() => {
    setLang(getLanguage())
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const headers = await getAuthHeaders()
        const hasAuth =
          typeof headers === 'object' &&
          headers !== null &&
          'Authorization' in (headers as Record<string, string>)

        if (hasAuth) {
          const meRes = await fetch(`${base}/api/users/me`, {
            headers: headers as Record<string, string>,
            credentials: 'include',
          })
          if (cancelled) return
          if (meRes.ok) {
            const me = (await meRes.json()) as User
            setUser(me)
            const sumRes = await fetch(`${base}/api/budget/summary`, {
              headers: headers as Record<string, string>,
              credentials: 'include',
            })
            if (cancelled) return
            if (sumRes.ok) {
              const data = (await sumRes.json()) as BudgetSummaryResponse
              setSummary(data)
            }
            setLoading(false)
            return
          }
          if (meRes.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('domus_token')
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          safePushLogin(router, 'budget-overview: no session')
          return
        }
        const meRes = await fetch(`${base}/api/users/me`, { credentials: 'include' })
        if (cancelled) return
        if (meRes.ok) {
          const me = (await meRes.json()) as User
          setUser(me)
        }
        const sumRes = await fetch(`${base}/api/budget/summary`, { credentials: 'include' })
        if (cancelled) return
        if (sumRes.ok) {
          const data = (await sumRes.json()) as BudgetSummaryResponse
          setSummary(data)
        }
      } catch (e) {
        console.error('Error cargando resumen presupuesto:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [router, base])

  const title =
    lang === 'es' ? 'Resumen de presupuesto por entidad' : 'Budget overview by entity'
  const subtitle =
    lang === 'es' ? 'Límites y gastado del mes actual' : 'Current month limits and spent'

  return (
    <SAPLayout user={user ?? undefined} title={title} subtitle={subtitle}>
      <div className="p-4 md:p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sap-muted">
              {lang === 'es' ? 'Cargando resumen...' : 'Loading summary...'}
            </p>
          </div>
        )}

        {!loading && summary && (
          <>
            {/* Resumen global */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {lang === 'es' ? 'Resumen global' : 'Global summary'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lang === 'es' ? 'Límite total' : 'Total limit'}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.global.limit, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lang === 'es' ? 'Gastado' : 'Spent'}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(summary.global.spent, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lang === 'es' ? 'Disponible' : 'Remaining'}
                  </p>
                  <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(summary.global.remaining, lang)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar
                  limit={summary.global.limit}
                  spent={summary.global.spent}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {summary.global.limit > 0
                    ? `${Math.min(
                        100,
                        Math.round(
                          (summary.global.spent / summary.global.limit) * 100
                        )
                      )}% ${lang === 'es' ? 'usado' : 'used'}`
                    : '—'}
                </p>
              </div>
            </section>

            {/* Cards por entidad */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lang === 'es' ? 'Por entidad' : 'By entity'}
              </h2>
              {summary.entities.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 py-4">
                  {lang === 'es'
                    ? 'No hay entidades con presupuesto asignado.'
                    : 'No entities with budget allocated.'}
                </p>
              )}
              {summary.entities.map((entity) => (
                <div
                  key={entity.entity_id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {entity.entity_name}
                    </h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {lang === 'es' ? 'Límite:' : 'Limit:'}{' '}
                        {formatCurrency(entity.total_limit, lang)}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {lang === 'es' ? 'Gastado:' : 'Spent:'}{' '}
                        {formatCurrency(entity.total_spent, lang)}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {lang === 'es' ? 'Disponible:' : 'Remaining:'}{' '}
                        {formatCurrency(entity.remaining, lang)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        limit={entity.total_limit}
                        spent={entity.total_spent}
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                          <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                            {lang === 'es' ? 'Categoría' : 'Category'}
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                            {lang === 'es' ? 'Límite' : 'Limit'}
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                            {lang === 'es' ? 'Gastado' : 'Spent'}
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                            {lang === 'es' ? 'Disponible' : 'Remaining'}
                          </th>
                          <th className="w-32 py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entity.categories.map((cat) => {
                          const pct =
                            cat.monthly_limit > 0
                              ? Math.min(
                                  100,
                                  (cat.spent_amount / cat.monthly_limit) * 100
                                )
                              : 0
                          const barColor = progressColor(pct)
                          return (
                            <tr
                              key={cat.category_id}
                              className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                              <td className="py-3 px-4 text-gray-900 dark:text-white">
                                {cat.category_name}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                                {formatCurrency(cat.monthly_limit, lang)}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                                {formatCurrency(cat.spent_amount, lang)}
                              </td>
                              <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(cat.remaining, lang)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {pct.toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {!loading && !summary && (
          <p className="text-gray-500 dark:text-gray-400 py-4">
            {lang === 'es'
              ? 'No se pudo cargar el resumen.'
              : 'Could not load summary.'}
          </p>
        )}
      </div>
    </SAPLayout>
  )
}

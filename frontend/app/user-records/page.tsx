'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import type { User } from '@/lib/types'
import SAPLayout from '@/components/SAPLayout'
import { formatCurrency } from '@/lib/currency'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'
import { safePushLogin } from '@/lib/receiptProcessing'
import { getAuthHeaders, getToken } from '@/lib/auth'

interface ReceiptItem {
  id: number
  receipt_id: number
  description: string
  amount: number
  quantity?: number
  unit_price?: number
  category?: string
  subcategory?: string
  assigned_transaction_id?: number
  notes?: string
  created_at: string
}

interface Receipt {
  id: number
  user_id: number
  image_url?: string
  whatsapp_message_id?: string
  whatsapp_phone?: string
  date?: string
  time?: string
  amount: number
  currency: string
  merchant_or_beneficiary?: string
  category?: string
  subcategory?: string
  concept?: string
  reference?: string
  operation_id?: string
  tracking_key?: string
  notes?: string
  status: string
  assigned_transaction_id?: number
  created_at: string
  updated_at?: string
  items: ReceiptItem[]
  user?: User
}

export default function UserRecordsPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const productsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const apiBase = backendUrl.replace(/\/$/, '')
  const parseNotes = (notes?: string) => {
    if (!notes) return null as any
    try {
      return JSON.parse(notes)
    } catch {
      return null as any
    }
  }

  const cleanItemName = (description: string) => {
    const s = String(description || '').trim()
    if (!s) return ''
    const tokens = s.split(/\s+/)
    let numericCount = 0
    let hasDecimal = false
    for (let i = tokens.length - 1; i >= 0 && numericCount < 5; i--) {
      const tok = tokens[i]
      const normalized = tok.replace(/[()]/g, '')
      if (/^-?\d+(?:[.,]\d+)?-?$/.test(normalized)) {
        numericCount += 1
        if (/[.,]\d+/.test(normalized)) hasDecimal = true
        continue
      }
      break
    }
    if (numericCount >= 2 && (hasDecimal || numericCount >= 3)) {
      return tokens.slice(0, Math.max(1, tokens.length - numericCount)).join(' ')
    }
    return s
  }

  const formatQty = (q: number) => Number(q).toFixed(3).replace(/\.?0+$/, '')

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const loadWithBackend = async () => {
      const headers = await getAuthHeaders()
      const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in (headers as Record<string, string>)
      if (!hasAuth) return false
      const token = getToken()
      if (!token) return false
      try {
        const meRes = await fetch(`${apiBase}/api/users/me`, {
          headers: headers as Record<string, string>,
          credentials: 'include',
        })
        if (!meRes.ok || cancelled) return false
        const meData = await meRes.json()
        setUser(meData as User)
        const recRes = await fetch(`${apiBase}/api/receipts/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (recRes.ok && !cancelled) {
          const list = await recRes.json()
          const mapped: Receipt[] = (list || []).map((r: Record<string, unknown>) => ({
            id: r.id as number,
            user_id: r.user_id as number,
            image_url: r.image_url as string | undefined,
            whatsapp_message_id: r.whatsapp_message_id as string | undefined,
            whatsapp_phone: r.whatsapp_phone as string | undefined,
            date: r.date as string | undefined,
            time: r.time as string | undefined,
            amount: Number(r.amount),
            currency: (r.currency as string) || 'MXN',
            merchant_or_beneficiary: r.merchant_or_beneficiary as string | undefined,
            category: typeof r.category === 'string' ? r.category : (r.category as string) || undefined,
            subcategory: typeof r.subcategory === 'string' ? r.subcategory : (r.subcategory as string) || undefined,
            concept: r.concept as string | undefined,
            reference: r.reference as string | undefined,
            operation_id: r.operation_id as string | undefined,
            tracking_key: r.tracking_key as string | undefined,
            notes: r.notes as string | undefined,
            status: (r.status as string) || 'pending',
            assigned_transaction_id: r.assigned_transaction_id as number | undefined,
            created_at: typeof r.created_at === 'string' ? r.created_at : (r.created_at as { isoformat?: () => string })?.isoformat?.() ?? '',
            updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
            items: ((r.items as Record<string, unknown>[]) || []).map((it: Record<string, unknown>) => ({
              id: it.id as number,
              receipt_id: it.receipt_id as number,
              description: (it.description as string) || '',
              amount: Number(it.amount),
              quantity: typeof it.quantity === 'number' ? Number(it.quantity) : (it.quantity != null ? Number(it.quantity) : undefined),
              unit_price: typeof it.unit_price === 'number' ? Number(it.unit_price) : (it.unit_price != null ? Number(it.unit_price) : undefined),
              category: it.category as string | undefined,
              subcategory: it.subcategory as string | undefined,
              assigned_transaction_id: it.assigned_transaction_id as number | undefined,
              notes: it.notes as string | undefined,
              created_at: typeof it.created_at === 'string' ? it.created_at : '',
            })),
          }))
          setReceipts(mapped)
        }
        return true
      } catch {
        return false
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadWithSupabase = async () => {
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 3000)
        ),
      ])
      if (cancelled) return
      if (!session) {
        safePushLogin(router, 'user-records: no supabase session')
        setLoading(false)
        return
      }
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        safePushLogin(router, 'user-records: no supabase user')
        setLoading(false)
        return
      }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (userData) {
        setUser(userData as User)
        const { data: receiptsData } = await supabase
          .from('receipts')
          .select('*, items:receipt_items(*)')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
        setReceipts((receiptsData || []) as Receipt[])
      }
      setLoading(false)
    }

    ;(async () => {
      const done = await loadWithBackend()
      if (cancelled) return
      if (!done) await loadWithSupabase()
    })()

    return () => { cancelled = true }
  }, [router])

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
      >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <SAPLayout user={user} title={language === 'es' ? 'Registros de Usuario' : 'User Records'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-sap-text-secondary">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </SAPLayout>
    )
  }

  return (
    <SAPLayout
      user={user}
      title={language === 'es' ? 'Registros de Usuario' : 'User Records'}
      subtitle={language === 'es' ? 'Visualiza todos tus tickets y recibos procesados' : 'View all your processed tickets and receipts'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Lista de recibos */}
        <div className="grid gap-4">
          {receipts.length === 0 ? (
            <div className="sap-card p-12 text-center">
              <p className="text-sap-text-secondary">
                {language === 'es' ? 'No hay recibos procesados' : 'No processed receipts'}
              </p>
            </div>
          ) : (
            receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="sap-card p-6 cursor-pointer hover:bg-sap-bgHover transition-colors"
                onClick={() => setSelectedReceipt(receipt)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold text-sap-text">
                        {receipt.merchant_or_beneficiary || (language === 'es' ? 'Recibo sin comercio' : 'Receipt without merchant')}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        receipt.status === 'assigned' ? 'bg-green-100 text-green-800' :
                        receipt.status === 'processed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {receipt.status === 'assigned' ? (language === 'es' ? 'Asignado' : 'Assigned') :
                         receipt.status === 'processed' ? (language === 'es' ? 'Procesado' : 'Processed') :
                         (language === 'es' ? 'Pendiente' : 'Pending')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-sap-text-secondary">{language === 'es' ? 'Fecha:' : 'Date:'}</span>{' '}
                        {receipt.date 
                          ? format(new Date(receipt.date + 'T' + (receipt.time || '00:00')), 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                          : format(new Date(receipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                        }
                      </div>
                      <div>
                        <span className="text-sap-text-secondary">{language === 'es' ? 'Monto:' : 'Amount:'}</span>{' '}
                        {formatCurrency(receipt.amount, language, false)}
                      </div>
                      <div>
                        <span className="text-sap-text-secondary">{language === 'es' ? 'Categoría:' : 'Category:'}</span>{' '}
                        {receipt.category || '-'}
                      </div>
                      <div>
                        <span className="text-sap-text-secondary">{language === 'es' ? 'Items:' : 'Items:'}</span>{' '}
                        {receipt.items?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de detalle del recibo */}
        {selectedReceipt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 border-b border-sap-border pb-4">
                  <h2 className="text-xl font-semibold text-sap-text">
                    {language === 'es' ? 'Detalle del Recibo' : 'Receipt Details'}
                  </h2>
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="sap-button-ghost p-2"
                  >
                    ✕
                  </button>
                </div>

                {(() => {
                  const isAdmin = Boolean((user as any)?.is_family_admin)
                  const itemsAll = selectedReceipt.items || []
                  const itemsWithNotes = itemsAll.map((it) => ({ ...it, _n: parseNotes(it.notes) }))

                  const hasIllegible = itemsWithNotes.some((it) => it._n?.amount_legible === false)
                  const sumAll = itemsWithNotes.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
                  const diff = (Number(selectedReceipt.amount) || 0) - sumAll
                  const diffAbs = Math.abs(diff)

                  const status = diffAbs < 0.01 ? (hasIllegible ? 'review' : 'ok') : 'error'
                  const statusLabel =
                    status === 'ok'
                      ? (language === 'es' ? 'Todo correcto' : 'All good')
                      : status === 'review'
                        ? (language === 'es' ? 'Revisar algunos productos' : 'Review some items')
                        : (language === 'es' ? 'Error en el total' : 'Total error')

                  const humanMsg =
                    status === 'ok'
                      ? (language === 'es' ? 'El total coincide con los productos.' : 'The total matches the items.')
                      : status === 'review'
                        ? (language === 'es' ? 'Revisa algunos productos antes de guardar.' : 'Review a few items before saving.')
                        : (language === 'es' ? 'No pudimos confirmar el total. Revisa el ticket o intenta de nuevo.' : 'We could not confirm the total. Please review or try again.')

                  const dateLabel = (() => {
                    try {
                      if (selectedReceipt.date) {
                        const dt = new Date(`${selectedReceipt.date}T${selectedReceipt.time || '00:00'}:00`)
                        return format(dt, 'dd/MM/yyyy HH:mm', { locale: language === 'es' ? es : enUS })
                      }
                      return format(new Date(selectedReceipt.created_at), 'dd/MM/yyyy', { locale: language === 'es' ? es : enUS })
                    } catch {
                      return selectedReceipt.date || ''
                    }
                  })()

                  const isNonProduct = (description: string, n: any) => {
                    const lineType = String(n?.line_type || '')
                    if (n?.is_adjustment === true || lineType === 'adjustment') return true
                    if (['discount', 'cancellation', 'price_change', 'adjustment'].includes(lineType)) return true
                    const up = String(description || '').toUpperCase()
                    if (up.includes('PROMOC') || up.includes('DESCU') || up.includes('CANCEL') || up.includes('CAMB. PRECIO') || up.includes('CAMBIO PRECIO')) return true
                    if (up.includes('AJUSTE PARA CUADRAR TOTAL')) return true
                    return false
                  }

                  const products = itemsWithNotes.filter((it) => !isNonProduct(it.description, it._n))

                  return (
                    <div className="space-y-6">
                      {/* Resumen superior */}
                      <div className="sap-card p-5 bg-sap-bgSecondary">
                        <div className="flex items-start justify-between gap-6">
                          <div className="min-w-0">
                            <div className="text-sm text-sap-text-secondary">{language === 'es' ? 'Comercio' : 'Merchant'}</div>
                            <div className="text-xl font-semibold text-sap-text truncate">
                              {selectedReceipt.merchant_or_beneficiary || (language === 'es' ? 'Recibo' : 'Receipt')}
                            </div>
                            <div className="text-sm text-sap-text-tertiary mt-1">{dateLabel}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm text-sap-text-secondary">{language === 'es' ? 'Total' : 'Total'}</div>
                            <div className="text-3xl font-bold text-sap-text">
                              {formatCurrency(selectedReceipt.amount, language, false)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-start gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-domus text-xs font-semibold ${
                              status === 'ok'
                                ? 'bg-green-100 text-green-800'
                                : status === 'review'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <p className="text-sm text-sap-text-secondary">{humanMsg}</p>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(null)}
                          className="sap-button-primary w-full sm:flex-1 text-base py-3"
                        >
                          {language === 'es' ? 'Confirmar y Guardar' : 'Confirm & Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="sap-button-secondary w-full sm:flex-1 text-base py-3"
                        >
                          {language === 'es' ? 'Revisar productos' : 'Review items'}
                        </button>
                      </div>

                      {/* Productos */}
                      <div ref={productsRef} className="sap-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-sap-border bg-white">
                          <h3 className="text-sm font-semibold text-sap-text">
                            {language === 'es' ? 'Productos' : 'Items'}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-sap-bgSecondary">
                              <tr>
                                <th className="sap-table-header">{language === 'es' ? 'Nombre' : 'Name'}</th>
                                <th className="sap-table-header text-right">
                                  {language === 'es' ? 'Cantidad × Precio = Total' : 'Qty × Price = Total'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {products.length === 0 ? (
                                <tr>
                                  <td colSpan={2} className="sap-table-cell text-center text-sap-text-secondary py-6">
                                    {language === 'es' ? 'No se encontraron productos.' : 'No items found.'}
                                  </td>
                                </tr>
                              ) : (
                                products.map((it, idx) => {
                                  const n = it._n
                                  const amountLegible = n?.amount_legible !== false
                                  const q = typeof it.quantity === 'number' ? it.quantity : null
                                  const up = typeof it.unit_price === 'number' ? it.unit_price : null
                                  const total = typeof it.amount === 'number' ? it.amount : Number(it.amount) || 0

                                  const name = amountLegible ? cleanItemName(it.description || '') : (language === 'es' ? 'No legible' : 'Illegible')
                                  const formula = !amountLegible
                                    ? (language === 'es' ? 'No legible' : 'Illegible')
                                    : (q != null && up != null)
                                      ? `${formatQty(q)} × ${formatCurrency(up, language, false)} = ${formatCurrency(total, language, false)}`
                                      : formatCurrency(total, language, false)

                                  return (
                                    <tr key={it.id ?? idx} className="border-b border-sap-border">
                                      <td className="sap-table-cell">
                                        <span className="text-sap-text">{name || (language === 'es' ? 'No legible' : 'Illegible')}</span>
                                      </td>
                                      <td className="sap-table-cell text-right font-medium text-sap-text">{formula}</td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Imagen */}
                      <div className="sap-card p-4">
                        <h3 className="text-sm font-semibold text-sap-text mb-3">
                          {language === 'es' ? 'Imagen del Ticket' : 'Ticket image'}
                        </h3>
                        {selectedReceipt.image_url ? (
                          <img
                            src={selectedReceipt.image_url}
                            alt={language === 'es' ? 'Recibo' : 'Receipt'}
                            className="w-full rounded border border-sap-border"
                          />
                        ) : (
                          <div className="w-full h-64 bg-sap-bgSecondary rounded border border-sap-border flex items-center justify-center">
                            <p className="text-sap-text-secondary">
                              {language === 'es' ? 'No hay imagen disponible' : 'No image available'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Detalles técnicos (solo Admin) */}
                      {isAdmin && (
                        <details className="sap-card p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-sap-text">
                            {language === 'es' ? 'Ver detalles técnicos' : 'View technical details'}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <pre className="sap-input font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-[360px]">
                              {selectedReceipt.notes ? String(selectedReceipt.notes) : JSON.stringify(selectedReceipt, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </SAPLayout>
  )
}

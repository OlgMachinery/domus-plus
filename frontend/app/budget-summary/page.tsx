'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { useTranslation, getLanguage, setLanguage, type Language } from '@/lib/i18n'
import { formatCurrency as formatCurrencyUtil } from '@/lib/currency'
import { safePushLogin } from '@/lib/receiptProcessing'
import { getAuthHeaders, getToken } from '@/lib/auth'
import { PencilSimple } from '@phosphor-icons/react'
import { XIcon } from '@/lib/icons'

interface Movement {
  id: number
  date: string
  amount: number
  type: 'income' | 'expense'
  merchant_or_beneficiary?: string
  concept?: string
  status?: string
}

interface BudgetAccount {
  id: number
  category: string
  subcategory: string
  category_display_name?: string
  subcategory_display_name?: string
  total_amount: number
  monthly_amount: number
  paid_amount: number
  remaining_amount: number
  income_amount: number
  movements_count: number
  movements: Movement[]
  due_date?: string
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue'
  is_overdue: boolean
  budget_type: 'shared' | 'individual'
  distribution_method: string
  contributors_count: number
  contributors: Array<{
    user_id: number
    user_name: string
    allocated_amount: number
    percentage: number
  }>
  notes?: string
  year: number
}

export default function BudgetSummaryPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const backendUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || ''
  const apiBase = backendUrl.replace(/\/$/, '')
  
  const [accounts, setAccounts] = useState<BudgetAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [editingAccount, setEditingAccount] = useState<number | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<BudgetAccount>>({})
  const [year, setYear] = useState(new Date().getFullYear())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [expandedMovements, setExpandedMovements] = useState<Set<number>>(new Set())
  const [showSummary, setShowSummary] = useState(true)

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const init = async () => {
      try {
        const headers = await getAuthHeaders()
        const hasAuth = typeof headers === 'object' && headers !== null && 'Authorization' in (headers as Record<string, string>)
        if (hasAuth) {
          setLoading(true)
          const meRes = await fetch(`${apiBase}/api/users/me`, {
            headers: headers as Record<string, string>,
            credentials: 'include',
          })
          if (meRes.ok && !cancelled) {
            const me = (await meRes.json()) as User
            setUser(me)
            await loadBudgetSummary(getToken() ?? undefined)
            return
          }
          if (meRes.status === 401) {
            localStorage.removeItem('domus_token')
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          safePushLogin(router, 'budget-summary: no supabase session')
          return
        }
        loadUser()
        loadBudgetSummary()
      } catch (err) {
        console.error('Error inicializando concentrado:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [router, year])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        safePushLogin(router, 'budget-summary: no supabase user')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
      const token = getToken()
      if (!token) safePushLogin(router, 'budget-summary: loadUser error')
    }
  }

  const loadBudgetSummary = async (tokenOverride?: string) => {
    try {
      setLoading(true)

      const token = tokenOverride || getToken()
      if (token) {
        const res = await fetch(`${apiBase}/api/budgets/summary?year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setAccounts((data || []) as BudgetAccount[])
        } else {
          // Puede fallar si el usuario aún no tiene familia
          setAccounts([])
        }
        return
      }

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setAccounts([])
        setLoading(false)
        return
      }
      
      // Obtener familia del usuario
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        setAccounts([])
        setLoading(false)
        return
      }
      
      // Cargar presupuestos familiares del año
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('family_budgets')
        .select('*')
        .eq('family_id', userData.family_id)
        .eq('year', year)
      
      if (budgetsError) {
        console.error('Error cargando presupuestos:', budgetsError)
        setAccounts([])
        setLoading(false)
        return
      }
      
      // Cargar transacciones relacionadas para calcular montos pagados
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('family_id', userData.family_id)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
      
      // Procesar presupuestos y calcular resumen
      const processedAccounts: BudgetAccount[] = (budgetsData || []).map((budget: any) => {
        const relatedTransactions = (transactionsData || []).filter(
          (t: any) => t.category === budget.category && t.subcategory === budget.subcategory
        )
        
        const paidAmount = relatedTransactions
          .filter((t: any) => t.transaction_type === 'expense')
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
        
        const incomeAmount = relatedTransactions
          .filter((t: any) => t.transaction_type === 'income')
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
        
        const monthlyAmount = budget.total_amount / 12
        const remainingAmount = budget.total_amount - paidAmount + incomeAmount
        
        return {
          id: budget.id,
          category: budget.category,
          subcategory: budget.subcategory,
          total_amount: budget.total_amount,
          monthly_amount: monthlyAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          income_amount: incomeAmount,
          movements_count: relatedTransactions.length,
          movements: relatedTransactions.map((t: any) => ({
            id: t.id,
            date: t.date,
            amount: t.amount,
            type: t.transaction_type,
            merchant_or_beneficiary: t.merchant_or_beneficiary,
            concept: t.concept,
            status: t.status
          })),
          due_date: budget.due_date,
          payment_status: remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
          is_overdue: budget.due_date ? new Date(budget.due_date) < new Date() && remainingAmount > 0 : false,
          budget_type: budget.budget_type || 'shared',
          distribution_method: budget.distribution_method || 'equal',
          contributors_count: 0,
          contributors: [],
          notes: budget.notes,
          year: budget.year || year
        }
      })
      
      setAccounts(processedAccounts)
    } catch (error: any) {
      console.error('Error cargando concentrado:', error)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  const handleEditStart = (account: BudgetAccount) => {
    setEditingAccount(account.id)
    setEditForm({
      category_display_name: account.category_display_name || account.category,
      subcategory_display_name: account.subcategory_display_name || account.subcategory,
      total_amount: account.total_amount,
      due_date: account.due_date || '',
      payment_status: account.payment_status,
      notes: account.notes || ''
    })
    setShowEditModal(true)
  }

  const handleEditCancel = () => {
    setEditingAccount(null)
    setEditForm({})
    setShowEditModal(false)
  }

  const handleEditSave = async (accountId: number) => {
    try {
      const updates: any = {}
      
      if (editForm.category_display_name !== undefined || editForm.subcategory_display_name !== undefined) {
        updates.display_names = {
          category: editForm.category_display_name || undefined,
          subcategory: editForm.subcategory_display_name || undefined
        }
      }
      
      if (editForm.total_amount !== undefined) {
        updates.total_amount = editForm.total_amount
      }
      
      if (editForm.due_date !== undefined) {
        updates.due_date = editForm.due_date || null
      }
      
      if (editForm.payment_status !== undefined) {
        updates.payment_status = editForm.payment_status
      }
      
      if (editForm.notes !== undefined) {
        updates.notes = editForm.notes
      }
      
      const token = getToken()
      if (token) {
        const res = await fetch(`${apiBase}/api/budgets/account/${accountId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al actualizar cuenta')
        }
      } else {
        // Actualizar en Supabase
        const { error } = await supabase
          .from('family_budgets')
          .update(updates)
          .eq('id', editingAccount)
        
        if (error) {
          throw error
        }
      }
      
      setEditingAccount(null)
      setEditForm({})
      setShowEditModal(false)
      loadBudgetSummary()
      alert(t.budgetSummary.accountUpdated)
    } catch (error: any) {
      console.error('Error actualizando cuenta:', error)
      alert(error.message || t.budgetSummary.errorUpdating)
    }
  }

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const toggleMovements = (accountId: number) => {
    const newExpanded = new Set(expandedMovements)
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId)
    } else {
      newExpanded.add(accountId)
    }
    setExpandedMovements(newExpanded)
  }

  // Calcular resúmenes - MEMOIZED
  const { 
    totalBudget, 
    totalPaid, 
    totalRemaining, 
    totalIncome, 
    monthlyBudget, 
    overdueCount, 
    overdueAmount, 
    pendingCount, 
    paidCount 
  } = useMemo(() => {
    const tBudget = accounts.reduce((sum, acc) => sum + acc.total_amount, 0)
    const tPaid = accounts.reduce((sum, acc) => sum + acc.paid_amount, 0)
    const tRemaining = accounts.reduce((sum, acc) => sum + acc.remaining_amount, 0)
    const tIncome = accounts.reduce((sum, acc) => sum + acc.income_amount, 0)
    const mBudget = tBudget / 12
    const oCount = accounts.filter(acc => acc.is_overdue).length
    const oAmount = accounts
      .filter(acc => acc.is_overdue)
      .reduce((sum, acc) => sum + Math.max(0, acc.remaining_amount), 0)
    const pCount = accounts.filter(acc => acc.payment_status === 'pending').length
    const pdCount = accounts.filter(acc => acc.payment_status === 'paid').length

    return {
      totalBudget: tBudget,
      totalPaid: tPaid,
      totalRemaining: tRemaining,
      totalIncome: tIncome,
      monthlyBudget: mBudget,
      overdueCount: oCount,
      overdueAmount: oAmount,
      pendingCount: pCount,
      paidCount: pdCount
    }
  }, [accounts])

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, language, false)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US')
  }

  const getPaymentStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-100 text-red-700'
    if (status === 'paid') return 'bg-green-100 text-green-700'
    if (status === 'partial') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-700'
  }

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, { es: string; en: string }> = {
      pending: { es: 'Pendiente', en: 'Pending' },
      partial: { es: 'Parcial', en: 'Partial' },
      paid: { es: 'Pagado', en: 'Paid' },
      overdue: { es: 'Vencido', en: 'Overdue' }
    }
    return labels[status]?.[language] || status
  }

  return (
    <div className="h-screen bg-sap-bg w-full overflow-hidden">
      {/* Header fijo unificado */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-sap-border shadow-sm">
        <div className="px-6 py-2 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="sap-button-ghost text-sm px-2 py-1.5 min-w-[32px] h-[32px] flex items-center justify-center text-sap-text-secondary hover:text-sap-text"
              title={language === 'es' ? 'Cerrar' : 'Close'}
            >
              <XIcon size={20} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-sap-text leading-tight">{t.budgetSummary.title}</h1>
              <p className="text-xs text-sap-text-secondary leading-tight">{t.budgetSummary.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
            >
              {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
            </button>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="sap-input text-sm w-20 h-[36px] px-2 py-1"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Dashboard de resumen profesional estilo SAP */}
        {showSummary && (
          <div className="px-6 py-3 bg-sap-bg-secondary border-t border-sap-border/30">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Annual Budget */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-sap-primary">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Presupuesto Anual' : 'Annual Budget'}
                  </div>
                </div>
                <div className="text-lg font-bold text-sap-text">{formatCurrency(totalBudget)}</div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {language === 'es' ? `${accounts.length} cuentas` : `${accounts.length} accounts`}
                </div>
              </div>

              {/* Monthly Budget */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Presupuesto Mensual' : 'Monthly Budget'}
                  </div>
                </div>
                <div className="text-lg font-bold text-blue-600">{formatCurrency(monthlyBudget)}</div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {language === 'es' ? 'Promedio mensual' : 'Monthly average'}
                </div>
              </div>

              {/* Overdue Amount */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Vencido' : 'Overdue'}
                  </div>
                </div>
                <div className="text-lg font-bold text-red-600">{formatCurrency(overdueAmount)}</div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {language === 'es' ? `${overdueCount} ${overdueCount === 1 ? 'cuenta' : 'cuentas'}` : `${overdueCount} ${overdueCount === 1 ? 'account' : 'accounts'}`}
                </div>
              </div>

              {/* Paid Amount */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Pagado' : 'Paid'}
                  </div>
                </div>
                <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {paidCount > 0 ? `${Math.round((totalPaid / totalBudget) * 100)}%` : '0%'} {language === 'es' ? 'utilizado' : 'utilized'}
                </div>
              </div>

              {/* Remaining Amount */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-yellow-500">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Restante' : 'Remaining'}
                  </div>
                </div>
                <div className={`text-lg font-bold ${totalRemaining >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatCurrency(totalRemaining)}
                </div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {totalRemaining >= 0 
                    ? (language === 'es' ? 'Disponible' : 'Available')
                    : (language === 'es' ? 'Sobregiro' : 'Overdraft')
                  }
                </div>
              </div>

              {/* Income Amount */}
              <div className="sap-card p-3 min-h-[80px] flex flex-col justify-between border-l-4 border-blue-400">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-sap-text-secondary uppercase tracking-wide">
                    {language === 'es' ? 'Ingresos' : 'Income'}
                  </div>
                </div>
                <div className="text-lg font-bold text-blue-500">{formatCurrency(totalIncome)}</div>
                <div className="text-xs text-sap-text-tertiary mt-1">
                  {language === 'es' ? 'Adicionales' : 'Additional'}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Sidebar colapsable */}
      {!sidebarCollapsed && (
        <aside className="fixed left-0 top-0 h-full w-48 bg-sap-sidebar border-r border-sap-border z-40 hidden">
          <div className="pt-16">
            <nav className="px-2 py-4 space-y-1">
              <a href="/dashboard" className="block px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded transition-colors">Dashboard</a>
              <a href="/budgets" className="block px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded transition-colors">Presupuestos</a>
              <a href="/transactions" className="block px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded transition-colors">Transacciones</a>
              <a href="/budget-summary" className="block px-3 py-2 text-xs bg-sap-primary text-white rounded">Annual Budget Summary</a>
              <a href="/logs" className="block px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded transition-colors">Logs</a>
            </nav>
          </div>
        </aside>
      )}

      {/* Contenido principal */}
      <main className={`px-6 py-4 transition-all duration-300 w-full ${showSummary ? 'mt-[180px]' : 'mt-[73px]'}`} style={{ height: `calc(100vh - ${showSummary ? 180 : 73}px)`, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {loading ? (
          <div className="sap-card p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sap-primary mx-auto"></div>
            <p className="text-sm text-sap-text-secondary mt-4">{t.budgetSummary.loading}</p>
          </div>
        ) : accounts.length > 0 ? (
          <div className="sap-card w-full flex-1 flex flex-col p-0 overflow-hidden">
            <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
            <table className="sap-table w-full" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-sap-bg-secondary" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  <th className="w-[160px] text-left px-1.5 py-1.5 text-xs">{t.budgetSummary.account}</th>
                  <th className="w-[95px] text-right px-1.5 py-1.5 text-xs">{language === 'es' ? 'Presupuesto' : 'Budget'}</th>
                  <th className="w-[95px] text-right px-1.5 py-1.5 text-xs">{language === 'es' ? 'Pagado' : 'Paid'}</th>
                  <th className="w-[95px] text-right px-1.5 py-1.5 text-xs">{language === 'es' ? 'Restante' : 'Remaining'}</th>
                  <th className="w-[100px] text-right px-1.5 py-1.5 text-xs">{language === 'es' ? 'Vencimiento' : 'Due Date'}</th>
                  <th className="w-[85px] text-center px-1.5 py-1.5 text-xs">{language === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="w-[85px] text-center px-1.5 py-1.5 text-xs">{language === 'es' ? 'Movimientos' : 'Movements'}</th>
                  <th className="w-[120px] text-left px-1.5 py-1.5 text-xs">{t.budgetSummary.contributors}</th>
                  <th className="w-[75px] text-center px-1.5 py-1.5 text-xs">{t.budgets.type}</th>
                  <th className="w-[50px] text-center px-1.5 py-1.5 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <>
                    <tr key={account.id} className="hover:bg-sap-bg-hover">
                      <td className="px-2 py-2 border-r border-sap-border/30">
                        <div>
                          <div className="font-medium text-sap-text text-xs truncate" title={account.category_display_name || account.category}>
                            {account.category_display_name || account.category}
                          </div>
                          <div className="text-xs text-sap-text-secondary truncate" title={account.subcategory_display_name || account.subcategory}>
                            {account.subcategory_display_name || account.subcategory}
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-2 py-2 border-r border-sap-border/30">
                        <span className="text-xs font-semibold text-sap-text whitespace-nowrap">{formatCurrency(Math.round(account.total_amount))}</span>
                      </td>
                      <td className="text-right px-2 py-2 border-r border-sap-border/30">
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">{formatCurrency(Math.round(account.paid_amount))}</span>
                      </td>
                      <td className="text-right px-2 py-2 border-r border-sap-border/30">
                        <span className={`text-xs font-medium whitespace-nowrap ${account.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.round(account.remaining_amount))}
                        </span>
                      </td>
                      <td className="text-right px-2 py-2 border-r border-sap-border/30">
                        <span className="text-xs text-sap-text-secondary whitespace-nowrap">{formatDate(account.due_date)}</span>
                      </td>
                      <td className="text-center px-2 py-2 border-r border-sap-border/30">
                        <span className={`text-xs px-1 py-0.5 rounded whitespace-nowrap inline-block ${getPaymentStatusColor(account.payment_status, account.is_overdue)}`}>
                          {getPaymentStatusLabel(account.payment_status)}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2 border-r border-sap-border/30">
                        <button
                          onClick={() => toggleMovements(account.id)}
                          className="text-xs text-sap-primary hover:underline px-0.5 py-0.5 rounded hover:bg-sap-primary/10 transition-colors"
                        >
                          {account.movements_count} {expandedMovements.has(account.id) ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-2 py-2 border-r border-sap-border/30">
                        <div className="text-xs text-sap-text-secondary">
                          {account.contributors_count} {t.budgets.membersSelected}
                        </div>
                        {account.contributors.length > 0 && (
                          <details className="text-xs mt-0.5">
                            <summary className="cursor-pointer text-sap-primary hover:underline whitespace-nowrap text-xs">
                              {t.common.details}
                            </summary>
                            <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                              {account.contributors.map((contrib, idx) => (
                                <div key={idx} className="pl-1 text-xs">
                                  <span className="font-medium">{contrib.user_name}:</span> {formatCurrency(Math.round(contrib.allocated_amount))} ({Math.round(contrib.percentage)}%)
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="text-center px-2 py-2 border-r border-sap-border/30">
                        <span className={`text-xs px-1 py-0.5 rounded whitespace-nowrap inline-block ${
                          account.budget_type === 'shared' 
                            ? 'bg-sap-primary/10 text-sap-primary' 
                            : 'bg-sap-warning/10 text-sap-warning'
                        }`}>
                          {account.budget_type === 'shared' ? t.budgets.shared : t.budgets.individual}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2">
                        <button
                          onClick={() => handleEditStart(account)}
                          className="sap-button-secondary text-xs px-1.5 py-0.5 w-[28px] h-[22px] flex items-center justify-center"
                          title={t.common.edit}
                        >
                          <PencilSimple size={14} />
                        </button>
                      </td>
                    </tr>
                    {expandedMovements.has(account.id) && account.movements.length > 0 && (
                      <tr>
                        <td colSpan={10} className="bg-sap-bg-secondary p-4">
                          <div className="text-xs font-semibold mb-2">{language === 'es' ? 'Movimientos' : 'Movements'}</div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {account.movements.map((mov) => (
                              <div key={mov.id} className="flex items-center justify-between py-1 border-b border-sap-border last:border-0">
                                <div className="flex-1">
                                  <span className="text-xs text-sap-text-secondary">{formatDate(mov.date)}</span>
                                  <span className="text-xs text-sap-text ml-2">{mov.merchant_or_beneficiary || mov.concept || '-'}</span>
                                </div>
                                <span className={`text-xs font-medium ${mov.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {mov.type === 'income' ? '+' : '-'}{formatCurrency(Math.round(mov.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div className="sap-card p-12 text-center">
            <p className="text-sm text-sap-text-secondary">{t.budgetSummary.noAccounts}</p>
          </div>
        )}
      </main>

      {/* Modal de edición */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="sap-card max-w-lg w-full mx-4 shadow-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b border-sap-border pb-4">
                <h2 className="text-lg font-semibold text-sap-text">{language === 'es' ? 'Editar Cuenta' : 'Edit Account'}</h2>
                <button onClick={handleEditCancel} className="sap-button-ghost p-2">
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Categoría' : 'Category'}</label>
                  <input
                    type="text"
                    value={editForm.category_display_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, category_display_name: e.target.value })}
                    className="sap-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Subcategoría' : 'Subcategory'}</label>
                  <input
                    type="text"
                    value={editForm.subcategory_display_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, subcategory_display_name: e.target.value })}
                    className="sap-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Monto Total' : 'Total Amount'}</label>
                    <input
                      type="number"
                      value={editForm.total_amount || 0}
                      onChange={(e) => setEditForm({ ...editForm, total_amount: parseFloat(e.target.value) })}
                      className="sap-input text-right"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Vencimiento' : 'Due Date'}</label>
                    <input
                      type="date"
                      value={editForm.due_date ? new Date(editForm.due_date).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                      className="sap-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Estado' : 'Status'}</label>
                  <select
                    value={editForm.payment_status || 'pending'}
                    onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value as any })}
                    className="sap-input"
                  >
                    <option value="pending">{getPaymentStatusLabel('pending')}</option>
                    <option value="partial">{getPaymentStatusLabel('partial')}</option>
                    <option value="paid">{getPaymentStatusLabel('paid')}</option>
                    <option value="overdue">{getPaymentStatusLabel('overdue')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">{language === 'es' ? 'Notas' : 'Notes'}</label>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="sap-input"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-sap-border mt-6">
                <button onClick={() => handleEditSave(editingAccount)} className="sap-button-primary flex-1">{t.common.save}</button>
                <button onClick={handleEditCancel} className="sap-button-secondary flex-1">{t.common.cancel}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
